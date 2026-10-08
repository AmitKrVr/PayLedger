import { env } from '@payledger/config';
import { db, PaymentStatus, type payments } from '@payledger/database';
import { generateBusinessId } from '@payledger/shared';

import { ERROR_CODES } from '../../constants/response.constants.js';
import { ERROR_MESSAGES } from '../../constants/message.constants.js';
import { inrToPaise, paiseToInr } from '../../lib/money.js';
import { logger } from '../../lib/logger.js';
import {
    BusinessRuleError,
    NotFoundError,
} from '../../middleware/error.middleware.js';

import {
    createGatewayPayment,
    simulateGatewayPayment,
} from '../../integrations/payment-gateway/payment-gateway.client.js';
import { creditWallet } from '../wallet/wallet.operations.js';
import { findWalletByUserId } from '../wallet/wallet.repository.js';

import {
    countPaymentsForUser,
    createDepositTransaction,
    createPayment as createPaymentRecord,
    findPaymentByIdForUser,
    findPaymentByOrderIdForUpdate,
    findPaymentByUserAndIdempotencyKey,
    findPaymentsForUser,
    updatePaymentGatewayInfo,
    updatePaymentStatus,
    updatePaymentSuccess,
} from './payment.repository.js';
import {
    idempotencyKeyHeaderSchema,
    webhookPayloadSchema,
    type CreatePaymentInput,
    type ListPaymentsQuery,
    type SimulatePaymentInput,
} from './payment.validator.js';

/** The only payment provider PayLedger integrates with today. */
const PAYMENT_PROVIDER = 'FAKE_GATEWAY';

type PaymentResponse = {
    id: string;
    orderId: string;
    amount: number;
    status: PaymentStatus;
    failureReason: string | null;
    createdAt: Date;
    expiresAt: Date | null;
};

const toPaymentResponse = (
    payment: typeof payments.$inferSelect,
): PaymentResponse => ({
    id: payment.id,
    orderId: payment.orderId,
    amount: paiseToInr(payment.amountPaise),
    status: payment.status,
    failureReason: payment.failureReason,
    createdAt: payment.createdAt,
    expiresAt: payment.expiresAt,
});

const isUniqueViolation = (error: unknown): boolean => {
    const code =
        (error as { cause?: { code?: string } })?.cause?.code ??
        (error as { code?: string })?.code;

    return code === '23505';
};

export const createPayment = async (
    userId: string,
    input: CreatePaymentInput,
    idempotencyKeyHeader: string | undefined,
    gatewayBaseUrl?: string,
): Promise<PaymentResponse> => {
    const { 'idempotency-key': idempotencyKey } =
        idempotencyKeyHeaderSchema.parse({
            'idempotency-key': idempotencyKeyHeader,
        });

    const existing = await findPaymentByUserAndIdempotencyKey(
        userId,
        idempotencyKey,
    );

    if (existing) {
        return toPaymentResponse(existing);
    }

    const amountPaise = inrToPaise(input.amount);
    const orderId = `ORD${generateBusinessId()}`;

    const expiresAt = new Date(
        Date.now() + env.PAYMENT_EXPIRY_MINUTES * 60 * 1000,
    );

    let payment;

    try {
        payment = await createPaymentRecord({
            userId,
            orderId,
            provider: PAYMENT_PROVIDER,
            amountPaise,
            idempotencyKey,
            expiresAt,
        });
    } catch (error) {
        // Two requests with the same Idempotency-Key racing past the
        // findPaymentByUserAndIdempotencyKey check above both try to
        // insert; the loser hits the unique index instead of creating a
        // duplicate payment — re-fetch and return the winner's row.
        if (isUniqueViolation(error)) {
            const existingAfterRace =
                await findPaymentByUserAndIdempotencyKey(
                    userId,
                    idempotencyKey,
                );

            if (existingAfterRace) {
                return toPaymentResponse(existingAfterRace);
            }
        }

        throw error;
    }

    // The PayLedger payment row is already committed (a single INSERT is
    // its own atomic unit) — the gateway call below happens with no DB
    // transaction open, so a slow or failing upstream call never holds a
    // connection or row lock.
    try {
        const gatewayOrder = await createGatewayPayment(
            { orderId, amountPaise },
            gatewayBaseUrl,
        );

        const updated = await updatePaymentGatewayInfo(payment.id, {
            paymentId: gatewayOrder.paymentId,
        });

        return toPaymentResponse(updated);
    } catch (error) {
        // No real order exists at the provider — mark the row FAILED so
        // the client never treats it as usable, and no future webhook
        // for this orderId can complete it into a credit.
        await updatePaymentStatus(
            payment.id,
            {
                status: PaymentStatus.FAILED,
                failureReason:
                    'Failed to create the payment order with the payment gateway',
            },
            db,
        );

        throw error;
    }
};

export const listPayments = async (
    userId: string,
    filters: Pick<ListPaymentsQuery, 'page' | 'limit' | 'status'>,
): Promise<{ items: PaymentResponse[]; totalItems: number }> => {
    const [rows, totalItems] = await Promise.all([
        findPaymentsForUser(userId, filters),
        countPaymentsForUser(userId, { status: filters.status }),
    ]);

    return {
        items: rows.map(toPaymentResponse),
        totalItems,
    };
};

export const getPayment = async (
    id: string,
    userId: string,
): Promise<PaymentResponse> => {
    const payment = await findPaymentByIdForUser(id, userId);

    if (!payment) {
        throw new NotFoundError(
            ERROR_MESSAGES.PAYMENT_NOT_FOUND,
            ERROR_CODES.PAYMENT_NOT_FOUND,
        );
    }

    return toPaymentResponse(payment);
};

/**
 * Proxies the Fake Payment Gateway's own test-checkout action so the
 * User Panel can actually finish a deposit -- the gateway has no hosted
 * checkout page, and the frontend must never call it directly, so this
 * is the only legitimate way a CREATED/PROCESSING payment ever reaches a
 * terminal state. The gateway call only triggers the real signed webhook;
 * this function never sets `payment.status` itself, so the SUCCESS/FAILED
 * transition and wallet credit always happen inside `processPaymentWebhook`
 * exactly as they would for a real payment provider.
 */
export const simulatePayment = async (
    id: string,
    userId: string,
    input: SimulatePaymentInput,
    gatewayBaseUrl?: string,
): Promise<PaymentResponse> => {
    const payment = await findPaymentByIdForUser(id, userId);

    if (!payment) {
        throw new NotFoundError(
            ERROR_MESSAGES.PAYMENT_NOT_FOUND,
            ERROR_CODES.PAYMENT_NOT_FOUND,
        );
    }

    if (
        payment.status !== PaymentStatus.CREATED &&
        payment.status !== PaymentStatus.PROCESSING
    ) {
        throw new BusinessRuleError(
            ERROR_MESSAGES.PAYMENT_NOT_COMPLETABLE,
            ERROR_CODES.PAYMENT_NOT_COMPLETABLE,
        );
    }

    if (!payment.paymentId) {
        throw new BusinessRuleError(
            ERROR_MESSAGES.PAYMENT_NOT_COMPLETABLE,
            ERROR_CODES.PAYMENT_NOT_COMPLETABLE,
        );
    }

    await simulateGatewayPayment(
        payment.paymentId,
        input.outcome,
        input.reason,
        gatewayBaseUrl,
    );

    // The webhook triggered by the call above has already been delivered
    // and processed by the time the gateway responds (it awaits delivery
    // before replying) -- re-read our own row rather than assume.
    const updated = await findPaymentByIdForUser(id, userId);

    return toPaymentResponse(updated ?? payment);
};

export const processPaymentWebhook = async (
    rawBody: unknown,
): Promise<void> => {
    const payload = webhookPayloadSchema.parse(rawBody);

    logger.info(
        {
            orderId: payload.orderId,
            paymentId: payload.paymentId,
            status: payload.status,
            amountPaise: payload.amount,
        },
        'Payment webhook payload validated, starting processing',
    );

    await db.transaction(async (tx) => {
        const payment = await findPaymentByOrderIdForUpdate(
            payload.orderId,
            tx,
        );

        if (!payment) {
            logger.warn(
                { orderId: payload.orderId },
                'Payment webhook: no payment found for orderId',
            );

            throw new NotFoundError(
                ERROR_MESSAGES.PAYMENT_NOT_FOUND,
                ERROR_CODES.PAYMENT_NOT_FOUND,
            );
        }

        if (payment.provider !== PAYMENT_PROVIDER) {
            logger.warn(
                {
                    orderId: payload.orderId,
                    paymentRowId: payment.id,
                    expectedProvider: PAYMENT_PROVIDER,
                    actualProvider: payment.provider,
                },
                'Payment webhook: provider mismatch',
            );

            throw new BusinessRuleError(
                ERROR_MESSAGES.PAYMENT_PROVIDER_MISMATCH,
                ERROR_CODES.PAYMENT_PROVIDER_MISMATCH,
            );
        }

        // Idempotency: CREATED/PROCESSING are the only non-terminal states.
        // A payment that already left them (SUCCESS/FAILED/CANCELLED/
        // EXPIRED) must not be processed again — same webhook delivered
        // five times, or two concurrent deliveries racing on this row
        // lock, both land here as a no-op after the first one commits.
        if (
            payment.status !== PaymentStatus.CREATED &&
            payment.status !== PaymentStatus.PROCESSING
        ) {
            logger.info(
                {
                    orderId: payload.orderId,
                    paymentRowId: payment.id,
                    currentStatus: payment.status,
                },
                'Payment webhook: already in a terminal state, ignoring as a duplicate delivery',
            );

            return;
        }

        const isExpired =
            payment.expiresAt !== null && payment.expiresAt <= new Date();

        if (isExpired) {
            logger.info(
                {
                    orderId: payload.orderId,
                    paymentRowId: payment.id,
                    expiresAt: payment.expiresAt,
                },
                'Payment webhook: payment expired before this webhook arrived, marking EXPIRED',
            );

            await updatePaymentStatus(
                payment.id,
                {
                    status: PaymentStatus.EXPIRED,
                    failureReason: 'Payment expired before completion',
                },
                tx,
            );

            return;
        }

        // payload.amount is already paise (the gateway's wire format),
        // unlike the INR amount the user originally requested.
        const webhookAmountPaise = BigInt(payload.amount);

        if (webhookAmountPaise !== payment.amountPaise) {
            logger.warn(
                {
                    orderId: payload.orderId,
                    paymentRowId: payment.id,
                    expectedAmountPaise: payment.amountPaise.toString(),
                    receivedAmountPaise: webhookAmountPaise.toString(),
                },
                'Payment webhook: amount mismatch',
            );

            throw new BusinessRuleError(
                ERROR_MESSAGES.PAYMENT_AMOUNT_MISMATCH,
                ERROR_CODES.PAYMENT_AMOUNT_MISMATCH,
            );
        }

        if (payload.status === 'FAILED') {
            logger.info(
                {
                    orderId: payload.orderId,
                    paymentRowId: payment.id,
                    failureReason: payload.failureReason,
                },
                'Payment webhook: gateway reported FAILED, marking payment FAILED',
            );

            await updatePaymentStatus(
                payment.id,
                {
                    status: PaymentStatus.FAILED,
                    failureReason:
                        payload.failureReason ??
                        'Payment failed at the gateway',
                },
                tx,
            );

            return;
        }

        const wallet = await findWalletByUserId(payment.userId, tx);

        if (!wallet) {
            logger.warn(
                {
                    orderId: payload.orderId,
                    paymentRowId: payment.id,
                    userId: payment.userId,
                },
                'Payment webhook: no wallet found for this user, cannot credit',
            );

            throw new NotFoundError(
                ERROR_MESSAGES.WALLET_NOT_FOUND,
                ERROR_CODES.WALLET_NOT_FOUND,
            );
        }

        const transaction = await createDepositTransaction(
            {
                referenceId: generateBusinessId(),
                userId: payment.userId,
                sourceId: payment.id,
                description: `Wallet deposit via ${payment.provider}`,
            },
            tx,
        );

        logger.info(
            {
                orderId: payload.orderId,
                paymentRowId: payment.id,
                walletId: wallet.id,
                userId: payment.userId,
                amountPaise: payment.amountPaise.toString(),
                transactionId: transaction.id,
            },
            'Payment webhook: SUCCESS, crediting wallet',
        );

        // Wallet eligibility (blocked/missing) is enforced inside
        // creditWallet() itself — if it rejects, this throw unwinds the
        // whole transaction, so the transaction record and payment status
        // above are rolled back too.
        await creditWallet({
            walletId: wallet.id,
            amountPaise: payment.amountPaise,
            transactionId: transaction.id,
            tx,
        });

        await updatePaymentSuccess(
            payment.id,
            { paymentId: payload.paymentId },
            tx,
        );

        logger.info(
            {
                orderId: payload.orderId,
                paymentRowId: payment.id,
                transactionId: transaction.id,
            },
            'Payment webhook: processing complete, payment marked SUCCESS',
        );
    });
};
