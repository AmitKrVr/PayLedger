import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';

import {
    db,
    payments,
    transactions,
    users,
    wallets,
    withdrawals,
    WalletType,
    type DatabaseOrTransaction,
    type UserStatus,
    type WalletStatus,
} from '@payledger/database';

export type ListUsersFilters = {
    search?: string;
    status?: UserStatus;
    walletStatus?: WalletStatus;
    from?: Date;
    to?: Date;
    sort: 'newest' | 'oldest';
    page: number;
    limit: number;
};

const buildUserConditions = (filters: ListUsersFilters) => {
    const conditions = [];

    if (filters.search) {
        const term = `%${filters.search}%`;
        conditions.push(
            or(
                ilike(users.name, term),
                ilike(users.mobile, term),
                ilike(users.email, term),
            ),
        );
    }

    if (filters.status) {
        conditions.push(eq(users.status, filters.status));
    }

    if (filters.walletStatus) {
        conditions.push(eq(wallets.status, filters.walletStatus));
    }

    if (filters.from) {
        conditions.push(gte(users.createdAt, filters.from));
    }

    if (filters.to) {
        conditions.push(lte(users.createdAt, filters.to));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
};

export const findUsers = async (
    filters: ListUsersFilters,
    executor: DatabaseOrTransaction = db,
) => {
    const orderBy =
        filters.sort === 'oldest'
            ? users.createdAt
            : desc(users.createdAt);

    return executor
        .select({
            id: users.id,
            name: users.name,
            mobile: users.mobile,
            email: users.email,
            status: users.status,
            createdAt: users.createdAt,
            walletStatus: wallets.status,
            walletBalancePaise: wallets.balancePaise,
            walletHeldPaise: wallets.heldPaise,
        })
        .from(users)
        .leftJoin(
            wallets,
            and(eq(wallets.userId, users.id), eq(wallets.walletType, WalletType.USER)),
        )
        .where(buildUserConditions(filters))
        .orderBy(orderBy)
        .limit(filters.limit)
        .offset((filters.page - 1) * filters.limit);
};

export const countUsers = async (
    filters: ListUsersFilters,
    executor: DatabaseOrTransaction = db,
): Promise<number> => {
    const [row] = await executor
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .leftJoin(
            wallets,
            and(eq(wallets.userId, users.id), eq(wallets.walletType, WalletType.USER)),
        )
        .where(buildUserConditions(filters));

    return row?.count ?? 0;
};

export const findUserById = async (
    id: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [row] = await executor
        .select({
            id: users.id,
            name: users.name,
            mobile: users.mobile,
            email: users.email,
            status: users.status,
            createdAt: users.createdAt,
            lastLoginAt: users.lastLoginAt,
            walletId: wallets.id,
            walletStatus: wallets.status,
            walletBalancePaise: wallets.balancePaise,
            walletHeldPaise: wallets.heldPaise,
        })
        .from(users)
        .leftJoin(
            wallets,
            and(eq(wallets.userId, users.id), eq(wallets.walletType, WalletType.USER)),
        )
        .where(eq(users.id, id))
        .limit(1);

    return row ?? null;
};

const RECENT_ACTIVITY_LIMIT = 5;

export const findRecentTransactionsForUser = async (
    userId: string,
    executor: DatabaseOrTransaction = db,
) =>
    executor
        .select({
            id: transactions.id,
            referenceId: transactions.referenceId,
            type: transactions.type,
            status: transactions.status,
            createdAt: transactions.createdAt,
        })
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.createdAt))
        .limit(RECENT_ACTIVITY_LIMIT);

export const findRecentPaymentsForUser = async (
    userId: string,
    executor: DatabaseOrTransaction = db,
) =>
    executor
        .select({
            id: payments.id,
            orderId: payments.orderId,
            amountPaise: payments.amountPaise,
            status: payments.status,
            createdAt: payments.createdAt,
        })
        .from(payments)
        .where(eq(payments.userId, userId))
        .orderBy(desc(payments.createdAt))
        .limit(RECENT_ACTIVITY_LIMIT);

export const findRecentWithdrawalsForUser = async (
    userId: string,
    executor: DatabaseOrTransaction = db,
) =>
    executor
        .select({
            id: withdrawals.id,
            amountPaise: withdrawals.amountPaise,
            status: withdrawals.status,
            requestedAt: withdrawals.createdAt,
        })
        .from(withdrawals)
        .innerJoin(wallets, eq(withdrawals.walletId, wallets.id))
        .where(eq(wallets.userId, userId))
        .orderBy(desc(withdrawals.createdAt))
        .limit(RECENT_ACTIVITY_LIMIT);
