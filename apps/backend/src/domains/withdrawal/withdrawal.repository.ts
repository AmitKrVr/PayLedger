import { and, desc, eq, sql } from 'drizzle-orm';

import {
    db,
    transactions,
    wallets,
    withdrawals,
    WithdrawalStatus,
    type DatabaseOrTransaction,
} from '@payledger/database';

const buildOwnershipConditions = (
    userId: string,
    status: WithdrawalStatus | undefined,
) => {
    const conditions = [eq(wallets.userId, userId)];

    if (status) {
        conditions.push(eq(withdrawals.status, status));
    }

    return and(...conditions);
};

/** Mirrors the admin-withdrawal repository's row shape, scoped to one
 * user's own withdrawals (via wallets.userId) and left-joined to
 * `transactions` for the business reference -- that row only exists once
 * a withdrawal has been APPROVED. */
export const findWithdrawalsForUser = async (
    userId: string,
    filters: { status?: WithdrawalStatus; page: number; limit: number },
    executor: DatabaseOrTransaction = db,
) => {
    return executor
        .select({
            id: withdrawals.id,
            referenceId: transactions.referenceId,
            amountPaise: withdrawals.amountPaise,
            status: withdrawals.status,
            createdAt: withdrawals.createdAt,
            updatedAt: withdrawals.updatedAt,
            processedAt: withdrawals.processedAt,
            rejectionReason: withdrawals.rejectionReason,
        })
        .from(withdrawals)
        .innerJoin(wallets, eq(withdrawals.walletId, wallets.id))
        .leftJoin(transactions, eq(withdrawals.transactionId, transactions.id))
        .where(buildOwnershipConditions(userId, filters.status))
        .orderBy(desc(withdrawals.createdAt), desc(withdrawals.id))
        .limit(filters.limit)
        .offset((filters.page - 1) * filters.limit);
};

export const countWithdrawalsForUser = async (
    userId: string,
    filters: { status?: WithdrawalStatus },
    executor: DatabaseOrTransaction = db,
): Promise<number> => {
    const [row] = await executor
        .select({ count: sql<number>`count(*)::int` })
        .from(withdrawals)
        .innerJoin(wallets, eq(withdrawals.walletId, wallets.id))
        .where(buildOwnershipConditions(userId, filters.status));

    return row?.count ?? 0;
};

export const findWithdrawalByIdForUser = async (
    id: string,
    userId: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [row] = await executor
        .select({
            id: withdrawals.id,
            referenceId: transactions.referenceId,
            amountPaise: withdrawals.amountPaise,
            status: withdrawals.status,
            createdAt: withdrawals.createdAt,
            updatedAt: withdrawals.updatedAt,
            processedAt: withdrawals.processedAt,
            rejectionReason: withdrawals.rejectionReason,
        })
        .from(withdrawals)
        .innerJoin(wallets, eq(withdrawals.walletId, wallets.id))
        .leftJoin(transactions, eq(withdrawals.transactionId, transactions.id))
        .where(and(eq(withdrawals.id, id), eq(wallets.userId, userId)))
        .limit(1);

    return row ?? null;
};

export const findWithdrawalByWalletAndIdempotencyKey = async (
    walletId: string,
    idempotencyKey: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [withdrawal] = await executor
        .select()
        .from(withdrawals)
        .where(
            and(
                eq(withdrawals.walletId, walletId),
                eq(withdrawals.idempotencyKey, idempotencyKey),
            ),
        )
        .limit(1);

    return withdrawal ?? null;
};

export const createWithdrawal = async (
    data: {
        walletId: string;
        amountPaise: bigint;
        idempotencyKey: string;
    },
    executor: DatabaseOrTransaction,
) => {
    const [withdrawal] = await executor
        .insert(withdrawals)
        .values({
            walletId: data.walletId,
            amountPaise: data.amountPaise,
            status: WithdrawalStatus.PENDING,
            idempotencyKey: data.idempotencyKey,
        })
        .returning();

    if (!withdrawal) {
        throw new Error('Failed to create withdrawal');
    }

    return withdrawal;
};
