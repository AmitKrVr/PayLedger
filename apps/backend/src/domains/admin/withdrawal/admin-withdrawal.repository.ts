import { desc, eq, sql } from 'drizzle-orm';

import {
    db,
    transactions,
    users,
    wallets,
    withdrawals,
    TransactionSourceType,
    TransactionStatus,
    TransactionType,
    WithdrawalStatus,
    type DatabaseOrTransaction,
} from '@payledger/database';

export const findWithdrawals = async (
    filters: {
        status?: WithdrawalStatus;
        page: number;
        limit: number;
    },
    executor: DatabaseOrTransaction = db,
) => {
    const whereClause = filters.status
        ? eq(withdrawals.status, filters.status)
        : undefined;

    return executor
        .select({
            id: withdrawals.id,
            amountPaise: withdrawals.amountPaise,
            status: withdrawals.status,
            requestedAt: withdrawals.requestedAt,
            processedAt: withdrawals.processedAt,
            userId: users.id,
            userName: users.name,
            userMobile: users.mobile,
        })
        .from(withdrawals)
        .innerJoin(wallets, eq(withdrawals.walletId, wallets.id))
        .innerJoin(users, eq(wallets.userId, users.id))
        .where(whereClause)
        .orderBy(desc(withdrawals.requestedAt))
        .limit(filters.limit)
        .offset((filters.page - 1) * filters.limit);
};

export const countWithdrawals = async (
    filters: { status?: WithdrawalStatus },
    executor: DatabaseOrTransaction = db,
): Promise<number> => {
    const whereClause = filters.status
        ? eq(withdrawals.status, filters.status)
        : undefined;

    const [row] = await executor
        .select({ count: sql<number>`count(*)::int` })
        .from(withdrawals)
        .where(whereClause);

    return row?.count ?? 0;
};

export const findWithdrawalByIdWithUser = async (
    id: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [row] = await executor
        .select({
            id: withdrawals.id,
            amountPaise: withdrawals.amountPaise,
            status: withdrawals.status,
            requestedAt: withdrawals.requestedAt,
            processedAt: withdrawals.processedAt,
            rejectionReason: withdrawals.rejectionReason,
            processedByAdminId: withdrawals.processedByAdminId,
            userId: users.id,
            userName: users.name,
            userMobile: users.mobile,
        })
        .from(withdrawals)
        .innerJoin(wallets, eq(withdrawals.walletId, wallets.id))
        .innerJoin(users, eq(wallets.userId, users.id))
        .where(eq(withdrawals.id, id))
        .limit(1);

    return row ?? null;
};

export const findWithdrawalForUpdate = async (
    id: string,
    executor: DatabaseOrTransaction,
) => {
    const [withdrawal] = await executor
        .select()
        .from(withdrawals)
        .where(eq(withdrawals.id, id))
        .for('update')
        .limit(1);

    return withdrawal ?? null;
};

/**
 * Records the completed WITHDRAWAL financial transaction for an approved
 * withdrawal. Created already COMPLETED — approval either finishes
 * atomically with the wallet debit inside one DB transaction, or the
 * whole thing rolls back, so there is no intermediate PENDING state here.
 */
export const createWithdrawalTransaction = async (
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
            type: TransactionType.WITHDRAWAL,
            status: TransactionStatus.COMPLETED,
            userId: data.userId,
            sourceType: TransactionSourceType.WITHDRAWAL,
            sourceId: data.sourceId,
            description: data.description,
            completedAt: new Date(),
        })
        .returning();

    if (!transaction) {
        throw new Error('Failed to create withdrawal transaction');
    }

    return transaction;
};

export const updateWithdrawalApproved = async (
    id: string,
    data: {
        transactionId: string;
        processedByAdminId: string;
    },
    executor: DatabaseOrTransaction,
) => {
    const [withdrawal] = await executor
        .update(withdrawals)
        .set({
            status: WithdrawalStatus.APPROVED,
            transactionId: data.transactionId,
            processedByAdminId: data.processedByAdminId,
            processedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(withdrawals.id, id))
        .returning();

    if (!withdrawal) {
        throw new Error('Failed to update withdrawal as approved');
    }

    return withdrawal;
};

export const updateWithdrawalRejected = async (
    id: string,
    data: {
        rejectionReason: string;
        processedByAdminId: string;
    },
    executor: DatabaseOrTransaction,
) => {
    const [withdrawal] = await executor
        .update(withdrawals)
        .set({
            status: WithdrawalStatus.REJECTED,
            rejectionReason: data.rejectionReason,
            processedByAdminId: data.processedByAdminId,
            processedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(withdrawals.id, id))
        .returning();

    if (!withdrawal) {
        throw new Error('Failed to update withdrawal as rejected');
    }

    return withdrawal;
};
