import { and, eq } from 'drizzle-orm';

import {
    db,
    payments,
    transactions,
    PaymentStatus,
    TransactionSourceType,
    TransactionStatus,
    TransactionType,
    type DatabaseOrTransaction,
} from '@payledger/database';

export const findPaymentByIdForUser = async (
    id: string,
    userId: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [payment] = await executor
        .select()
        .from(payments)
        .where(and(eq(payments.id, id), eq(payments.userId, userId)))
        .limit(1);

    return payment ?? null;
};

export const findPaymentByUserAndIdempotencyKey = async (
    userId: string,
    idempotencyKey: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [payment] = await executor
        .select()
        .from(payments)
        .where(
            and(
                eq(payments.userId, userId),
                eq(payments.idempotencyKey, idempotencyKey),
            ),
        )
        .limit(1);

    return payment ?? null;
};

export const findPaymentByOrderIdForUpdate = async (
    orderId: string,
    executor: DatabaseOrTransaction,
) => {
    const [payment] = await executor
        .select()
        .from(payments)
        .where(eq(payments.orderId, orderId))
        .for('update')
        .limit(1);

    return payment ?? null;
};

export const createPayment = async (
    data: {
        userId: string;
        orderId: string;
        provider: string;
        amountPaise: bigint;
        idempotencyKey: string;
        expiresAt: Date;
    },
    executor: DatabaseOrTransaction = db,
) => {
    const [payment] = await executor
        .insert(payments)
        .values({
            userId: data.userId,
            orderId: data.orderId,
            provider: data.provider,
            amountPaise: data.amountPaise,
            status: PaymentStatus.CREATED,
            idempotencyKey: data.idempotencyKey,
            expiresAt: data.expiresAt,
        })
        .returning();

    if (!payment) {
        throw new Error('Failed to create payment');
    }

    return payment;
};

export const updatePaymentStatus = async (
    id: string,
    data: {
        status: PaymentStatus;
        failureReason?: string | null;
    },
    executor: DatabaseOrTransaction,
) => {
    const [payment] = await executor
        .update(payments)
        .set({
            status: data.status,
            failureReason: data.failureReason ?? null,
            updatedAt: new Date(),
        })
        .where(eq(payments.id, id))
        .returning();

    if (!payment) {
        throw new Error('Failed to update payment status');
    }

    return payment;
};

export const updatePaymentSuccess = async (
    id: string,
    data: {
        paymentId: string;
    },
    executor: DatabaseOrTransaction,
) => {
    const [payment] = await executor
        .update(payments)
        .set({
            status: PaymentStatus.SUCCESS,
            paymentId: data.paymentId,
            paidAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(payments.id, id))
        .returning();

    if (!payment) {
        throw new Error('Failed to update payment to success');
    }

    return payment;
};

/**
 * Records the completed DEPOSIT financial transaction for a successful
 * payment. Created already COMPLETED — the deposit either finishes
 * atomically with the wallet credit inside one DB transaction, or the
 * whole thing rolls back, so there is no intermediate PENDING state here.
 */
export const createDepositTransaction = async (
    data: {
        referenceId: string;
        userId: string;
        sourceId: string;
        description: string;
    },
    executor: DatabaseOrTransaction,
) => {
    const [transaction] = await executor
        .insert(transactions)
        .values({
            referenceId: data.referenceId,
            type: TransactionType.DEPOSIT,
            status: TransactionStatus.COMPLETED,
            userId: data.userId,
            sourceType: TransactionSourceType.PAYMENT,
            sourceId: data.sourceId,
            description: data.description,
            completedAt: new Date(),
        })
        .returning();

    if (!transaction) {
        throw new Error('Failed to create deposit transaction');
    }

    return transaction;
};
