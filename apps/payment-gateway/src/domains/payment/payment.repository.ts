import { eq } from 'drizzle-orm';

import {
    db,
    gatewayPayments,
    GatewayPaymentStatus,
    type DatabaseOrTransaction,
} from '@payledger/database';

export const findGatewayPaymentByOrderId = async (
    orderId: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [payment] = await executor
        .select()
        .from(gatewayPayments)
        .where(eq(gatewayPayments.orderId, orderId))
        .limit(1);

    return payment ?? null;
};

export const findGatewayPaymentByPaymentIdForUpdate = async (
    paymentId: string,
    executor: DatabaseOrTransaction,
) => {
    const [payment] = await executor
        .select()
        .from(gatewayPayments)
        .where(eq(gatewayPayments.paymentId, paymentId))
        .for('update')
        .limit(1);

    return payment ?? null;
};

export const createGatewayPayment = async (
    data: {
        orderId: string;
        paymentId: string;
        amountPaise: bigint;
        currency: string;
    },
    executor: DatabaseOrTransaction = db,
) => {
    const [payment] = await executor
        .insert(gatewayPayments)
        .values({
            orderId: data.orderId,
            paymentId: data.paymentId,
            amountPaise: data.amountPaise,
            currency: data.currency,
            status: GatewayPaymentStatus.CREATED,
        })
        .returning();

    if (!payment) {
        throw new Error('Failed to create gateway payment');
    }

    return payment;
};

export const updateGatewayPaymentSuccess = async (
    id: string,
    executor: DatabaseOrTransaction,
) => {
    const [payment] = await executor
        .update(gatewayPayments)
        .set({
            status: GatewayPaymentStatus.SUCCESS,
            paidAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(gatewayPayments.id, id))
        .returning();

    if (!payment) {
        throw new Error('Failed to update gateway payment to SUCCESS');
    }

    return payment;
};

export const updateGatewayPaymentFailure = async (
    id: string,
    data: { failureReason: string },
    executor: DatabaseOrTransaction,
) => {
    const [payment] = await executor
        .update(gatewayPayments)
        .set({
            status: GatewayPaymentStatus.FAILED,
            failureReason: data.failureReason,
            updatedAt: new Date(),
        })
        .where(eq(gatewayPayments.id, id))
        .returning();

    if (!payment) {
        throw new Error('Failed to update gateway payment to FAILED');
    }

    return payment;
};
