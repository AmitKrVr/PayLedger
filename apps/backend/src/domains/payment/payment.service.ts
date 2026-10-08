import { env } from '@payledger/config';
import { db, PaymentStatus, type payments } from '@payledger/database';
import { generateBusinessId } from '@payledger/shared';

import { ERROR_CODES } from '../../constants/response.constants.js';
import { ERROR_MESSAGES } from '../../constants/message.constants.js';
import { inrToPaise, paiseToInr } from '../../lib/money.js';
import {
    BusinessRuleError,
    NotFoundError,
} from '../../middleware/error.middleware.js';

import { createGatewayPayment } from '../../integrations/payment-gateway/payment-gateway.client.js';
import { creditWallet } from '../wallet/wallet.operations.js';
import { findWalletByUserId } from '../wallet/wallet.repository.js';

import {
    createDepositTransaction,
    createPayment as createPaymentRecord,
    findPaymentByIdForUser,
    findPaymentByOrderIdForUpdate,
    findPaymentByUserAndIdempotencyKey,
    updatePaymentGatewayInfo,
    updatePaymentStatus,
    updatePaymentSuccess,
} from './payment.repository.js';
import {
    idempotencyKeyHeaderSchema,
    webhookPayloadSchema,
    type CreatePaymentInput,
} from './payment.validator.js';

/** The only payment provider PayLedger integrates with today. */
const PAYMENT_PROVIDER = 'FAKE_GATEWAY';

type PaymentResponse = {
    id: string;
    orderId: string;
    amount: number;
    status: PaymentStatus;
    expiresAt: Date | null;
};

const toPaymentResponse = (
    payment: typeof payments.$inferSelect,
): PaymentResponse => ({
    id: payment.id,
    orderId: payment.orderId,
    amount: paiseToInr(payment.amountPaise),
    status: payment.status,
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
    const orderId = generateBusinessId();

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

export const processPaymentWebhook = async (
    rawBody: unknown,
): Promise<void> => {
    const payload = webhookPayloadSchema.parse(rawBody);

    await db.transaction(async (tx) => {
        const payment = await findPaymentByOrderIdForUpdate(
            payload.orderId,
            tx,
        );

        if (!payment) {
            throw new NotFoundError(
                ERROR_MESSAGES.PAYMENT_NOT_FOUND,
                ERROR_CODES.PAYMENT_NOT_FOUND,
            );
        }

        if (payment.provider !== PAYMENT_PROVIDER) {
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
            return;
        }

        const isExpired =
            payment.expiresAt !== null && payment.expiresAt <= new Date();

        if (isExpired) {
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
            throw new BusinessRuleError(
                ERROR_MESSAGES.PAYMENT_AMOUNT_MISMATCH,
                ERROR_CODES.PAYMENT_AMOUNT_MISMATCH,
            );
        }

        if (payload.status === 'FAILED') {
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
    });
};
