import {
    db,
    GatewayPaymentStatus,
    type DatabaseOrTransaction,
    type gatewayPayments,
} from '@payledger/database';
import { generateBusinessId } from '@payledger/shared';

import { ERROR_MESSAGES } from './payment.constants.js';
import {
    ConflictError,
    NotFoundError,
} from '../../middleware/error.middleware.js';
import { sendPayledgerWebhook } from '../../integrations/payledger-webhook/payledger-webhook.client.js';

import {
    createGatewayPayment as createGatewayPaymentRecord,
    findGatewayPaymentByOrderId,
    findGatewayPaymentByPaymentIdForUpdate,
    updateGatewayPaymentFailure,
    updateGatewayPaymentSuccess,
} from './payment.repository.js';
import type { CreateGatewayPaymentInput } from './payment.validators.js';
import type { GatewayPaymentResponse } from './payment.types.js';

const PAISE_PER_INR = 100;
const paiseToInr = (paise: bigint): number => Number(paise) / PAISE_PER_INR;

type GatewayPaymentRow = typeof gatewayPayments.$inferSelect;

const toResponse = (
    payment: GatewayPaymentRow,
): GatewayPaymentResponse => ({
    id: payment.id,
    orderId: payment.orderId,
    paymentId: payment.paymentId,
    amount: paiseToInr(payment.amountPaise),
    currency: payment.currency,
    status: payment.status,
});

const isUniqueViolation = (error: unknown): boolean => {
    const code =
        (error as { cause?: { code?: string } })?.cause?.code ??
        (error as { code?: string })?.code;

    return code === '23505';
};

export const createGatewayPayment = async (
    input: CreateGatewayPaymentInput,
): Promise<GatewayPaymentResponse> => {
    const existing = await findGatewayPaymentByOrderId(input.orderId);

    if (existing) {
        throw new ConflictError(ERROR_MESSAGES.DUPLICATE_ORDER_ID);
    }

    const paymentId = `PAY${generateBusinessId()}`;

    try {
        const payment = await createGatewayPaymentRecord({
            orderId: input.orderId,
            paymentId,
            amountPaise: BigInt(input.amount),
            currency: input.currency,
        });

        return toResponse(payment);
    } catch (error) {
        // Two requests for the same orderId racing past the
        // findGatewayPaymentByOrderId check above both try to insert;
        // the loser hits the unique index instead of creating a second
        // gateway payment record for the same order.
        if (isUniqueViolation(error)) {
            throw new ConflictError(ERROR_MESSAGES.DUPLICATE_ORDER_ID);
        }

        throw error;
    }
};

const lockPaymentOrThrow = async (
    paymentId: string,
    tx: DatabaseOrTransaction,
): Promise<GatewayPaymentRow> => {
    const payment = await findGatewayPaymentByPaymentIdForUpdate(
        paymentId,
        tx,
    );

    if (!payment) {
        throw new NotFoundError(ERROR_MESSAGES.PAYMENT_NOT_FOUND);
    }

    return payment;
};

export const simulateSuccess = async (
    paymentId: string,
    webhookUrl?: string,
): Promise<GatewayPaymentResponse> => {
    const payment = await db.transaction(async (tx) => {
        const locked = await lockPaymentOrThrow(paymentId, tx);

        if (locked.status === GatewayPaymentStatus.SUCCESS) {
            // Already SUCCESS — no second record, no state change. The
            // webhook is still resent below so PayLedger's own webhook
            // idempotency can be exercised by repeated calls here.
            return locked;
        }

        if (locked.status === GatewayPaymentStatus.FAILED) {
            throw new ConflictError(ERROR_MESSAGES.ALREADY_FAILED);
        }

        return updateGatewayPaymentSuccess(locked.id, tx);
    });

    // Sent only after the DB transaction has committed, and never able
    // to affect the state committed above — see sendPayledgerWebhook.
    await sendPayledgerWebhook(
        {
            orderId: payment.orderId,
            paymentId: payment.paymentId,
            amountPaise: payment.amountPaise,
            currency: payment.currency,
            status: 'SUCCESS',
        },
        webhookUrl,
    );

    return toResponse(payment);
};

export const simulateFailure = async (
    paymentId: string,
    reason: string | undefined,
    webhookUrl?: string,
): Promise<GatewayPaymentResponse> => {
    const failureReason = reason ?? 'Payment declined';

    const payment = await db.transaction(async (tx) => {
        const locked = await lockPaymentOrThrow(paymentId, tx);

        if (locked.status === GatewayPaymentStatus.SUCCESS) {
            throw new ConflictError(ERROR_MESSAGES.ALREADY_SUCCEEDED);
        }

        if (locked.status === GatewayPaymentStatus.FAILED) {
            // Already FAILED — resend the webhook with the originally
            // stored failure reason below; never overwrite it here.
            return locked;
        }

        return updateGatewayPaymentFailure(
            locked.id,
            { failureReason },
            tx,
        );
    });

    await sendPayledgerWebhook(
        {
            orderId: payment.orderId,
            paymentId: payment.paymentId,
            amountPaise: payment.amountPaise,
            currency: payment.currency,
            status: 'FAILED',
            failureReason: payment.failureReason ?? failureReason,
        },
        webhookUrl,
    );

    return toResponse(payment);
};
