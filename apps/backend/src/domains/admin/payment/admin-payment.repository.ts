import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';

import {
    db,
    payments,
    users,
    type DatabaseOrTransaction,
    type PaymentStatus,
} from '@payledger/database';

export type ListPaymentsFilters = {
    search?: string;
    status?: PaymentStatus;
    from?: Date;
    to?: Date;
    minAmountPaise?: bigint;
    maxAmountPaise?: bigint;
    page: number;
    limit: number;
};

const buildPaymentConditions = (filters: ListPaymentsFilters) => {
    const conditions = [];

    if (filters.search) {
        const term = `%${filters.search}%`;
        conditions.push(
            or(
                ilike(payments.orderId, term),
                ilike(payments.paymentId, term),
                ilike(users.name, term),
                ilike(users.mobile, term),
            ),
        );
    }

    if (filters.status) {
        conditions.push(eq(payments.status, filters.status));
    }

    if (filters.from) {
        conditions.push(gte(payments.createdAt, filters.from));
    }

    if (filters.to) {
        conditions.push(lte(payments.createdAt, filters.to));
    }

    if (filters.minAmountPaise !== undefined) {
        conditions.push(gte(payments.amountPaise, filters.minAmountPaise));
    }

    if (filters.maxAmountPaise !== undefined) {
        conditions.push(lte(payments.amountPaise, filters.maxAmountPaise));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
};

export const findPayments = async (
    filters: ListPaymentsFilters,
    executor: DatabaseOrTransaction = db,
) =>
    executor
        .select({
            id: payments.id,
            orderId: payments.orderId,
            paymentId: payments.paymentId,
            amountPaise: payments.amountPaise,
            status: payments.status,
            provider: payments.provider,
            createdAt: payments.createdAt,
            paidAt: payments.paidAt,
            expiresAt: payments.expiresAt,
            userId: users.id,
            userName: users.name,
            userMobile: users.mobile,
        })
        .from(payments)
        .innerJoin(users, eq(payments.userId, users.id))
        .where(buildPaymentConditions(filters))
        .orderBy(desc(payments.createdAt))
        .limit(filters.limit)
        .offset((filters.page - 1) * filters.limit);

export const countPayments = async (
    filters: ListPaymentsFilters,
    executor: DatabaseOrTransaction = db,
): Promise<number> => {
    const [row] = await executor
        .select({ count: sql<number>`count(*)::int` })
        .from(payments)
        .innerJoin(users, eq(payments.userId, users.id))
        .where(buildPaymentConditions(filters));

    return row?.count ?? 0;
};

export const findPaymentByIdWithUser = async (
    id: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [row] = await executor
        .select({
            id: payments.id,
            orderId: payments.orderId,
            paymentId: payments.paymentId,
            amountPaise: payments.amountPaise,
            currency: payments.currency,
            status: payments.status,
            provider: payments.provider,
            failureReason: payments.failureReason,
            metadata: payments.metadata,
            createdAt: payments.createdAt,
            updatedAt: payments.updatedAt,
            paidAt: payments.paidAt,
            expiresAt: payments.expiresAt,
            userId: users.id,
            userName: users.name,
            userMobile: users.mobile,
        })
        .from(payments)
        .innerJoin(users, eq(payments.userId, users.id))
        .where(eq(payments.id, id))
        .limit(1);

    return row ?? null;
};
