import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';

import {
    db,
    transactions,
    transfers,
    users,
    wallets,
    TransactionSourceType,
    TransactionStatus,
    TransactionType,
    TransferStatus,
    type DatabaseOrTransaction,
    type TransferStatus as TransferStatusType,
} from '@payledger/database';

const senderWallets = alias(wallets, 'admin_tf_sender_wallets');
const receiverWallets = alias(wallets, 'admin_tf_receiver_wallets');
const senderUsers = alias(users, 'admin_tf_sender_users');
const receiverUsers = alias(users, 'admin_tf_receiver_users');

export type ListTransfersFilters = {
    search?: string;
    status?: TransferStatusType;
    from?: Date;
    to?: Date;
    minAmountPaise?: bigint;
    maxAmountPaise?: bigint;
    page: number;
    limit: number;
};

const buildTransferConditions = (filters: ListTransfersFilters) => {
    const conditions = [];

    if (filters.search) {
        const term = `%${filters.search}%`;
        conditions.push(
            or(
                ilike(transactions.referenceId, term),
                ilike(senderUsers.name, term),
                ilike(senderUsers.mobile, term),
                ilike(receiverUsers.name, term),
                ilike(receiverUsers.mobile, term),
            ),
        );
    }

    if (filters.status) {
        conditions.push(eq(transfers.status, filters.status));
    }

    if (filters.from) {
        conditions.push(gte(transfers.createdAt, filters.from));
    }

    if (filters.to) {
        conditions.push(lte(transfers.createdAt, filters.to));
    }

    if (filters.minAmountPaise !== undefined) {
        conditions.push(gte(transfers.amountPaise, filters.minAmountPaise));
    }

    if (filters.maxAmountPaise !== undefined) {
        conditions.push(lte(transfers.amountPaise, filters.maxAmountPaise));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
};

const transferListSelection = {
    id: transfers.id,
    referenceId: transactions.referenceId,
    amountPaise: transfers.amountPaise,
    feePaise: transfers.feePaise,
    totalPaise: transfers.totalPaise,
    status: transfers.status,
    createdAt: transfers.createdAt,
    completedAt: transfers.completedAt,
    senderUserId: senderUsers.id,
    senderName: senderUsers.name,
    senderMobile: senderUsers.mobile,
    receiverUserId: receiverUsers.id,
    receiverName: receiverUsers.name,
    receiverMobile: receiverUsers.mobile,
};

export const findTransfers = async (
    filters: ListTransfersFilters,
    executor: DatabaseOrTransaction = db,
) =>
    executor
        .select(transferListSelection)
        .from(transfers)
        .innerJoin(transactions, eq(transfers.transactionId, transactions.id))
        .innerJoin(senderWallets, eq(transfers.senderWalletId, senderWallets.id))
        .innerJoin(senderUsers, eq(senderWallets.userId, senderUsers.id))
        .innerJoin(receiverWallets, eq(transfers.receiverWalletId, receiverWallets.id))
        .innerJoin(receiverUsers, eq(receiverWallets.userId, receiverUsers.id))
        .where(buildTransferConditions(filters))
        .orderBy(desc(transfers.createdAt))
        .limit(filters.limit)
        .offset((filters.page - 1) * filters.limit);

export const countTransfers = async (
    filters: ListTransfersFilters,
    executor: DatabaseOrTransaction = db,
): Promise<number> => {
    const [row] = await executor
        .select({ count: sql<number>`count(*)::int` })
        .from(transfers)
        .innerJoin(transactions, eq(transfers.transactionId, transactions.id))
        .innerJoin(senderWallets, eq(transfers.senderWalletId, senderWallets.id))
        .innerJoin(senderUsers, eq(senderWallets.userId, senderUsers.id))
        .innerJoin(receiverWallets, eq(transfers.receiverWalletId, receiverWallets.id))
        .innerJoin(receiverUsers, eq(receiverWallets.userId, receiverUsers.id))
        .where(buildTransferConditions(filters));

    return row?.count ?? 0;
};

export const findTransferByIdWithParties = async (
    id: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [row] = await executor
        .select(transferListSelection)
        .from(transfers)
        .innerJoin(transactions, eq(transfers.transactionId, transactions.id))
        .innerJoin(senderWallets, eq(transfers.senderWalletId, senderWallets.id))
        .innerJoin(senderUsers, eq(senderWallets.userId, senderUsers.id))
        .innerJoin(receiverWallets, eq(transfers.receiverWalletId, receiverWallets.id))
        .innerJoin(receiverUsers, eq(receiverWallets.userId, receiverUsers.id))
        .where(eq(transfers.id, id))
        .limit(1);

    return row ?? null;
};

/** The reversal's own transaction row, if this transfer has been reversed
 * -- created with sourceType REVERSAL and sourceId = the transfer's id
 * (see createReversalTransaction below). */
export const findReversalTransactionForTransfer = async (
    transferId: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [row] = await executor
        .select({
            referenceId: transactions.referenceId,
            completedAt: transactions.completedAt,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.sourceType, TransactionSourceType.REVERSAL),
                eq(transactions.sourceId, transferId),
            ),
        )
        .limit(1);

    return row ?? null;
};

export const findTransferForUpdate = async (
    id: string,
    executor: DatabaseOrTransaction,
) => {
    const [transfer] = await executor
        .select()
        .from(transfers)
        .where(eq(transfers.id, id))
        .for('update')
        .limit(1);

    return transfer ?? null;
};

/**
 * Records the completed TRANSFER_REVERSAL financial transaction. Created
 * already COMPLETED — the reversal either finishes atomically with both
 * wallet movements inside one DB transaction, or the whole thing rolls
 * back, so there is no intermediate PENDING state here.
 */
export const createReversalTransaction = async (
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
            type: TransactionType.TRANSFER_REVERSAL,
            status: TransactionStatus.COMPLETED,
            userId: data.userId,
            sourceType: TransactionSourceType.REVERSAL,
            sourceId: data.sourceId,
            description: data.description,
            completedAt: new Date(),
        })
        .returning();

    if (!transaction) {
        throw new Error('Failed to create reversal transaction');
    }

    return transaction;
};

/** `status` is the only column on `transfers` a reversal is allowed to change. */
export const updateTransferAsReversed = async (
    id: string,
    executor: DatabaseOrTransaction,
) => {
    const [transfer] = await executor
        .update(transfers)
        .set({ status: TransferStatus.REVERSED })
        .where(eq(transfers.id, id))
        .returning();

    if (!transfer) {
        throw new Error('Failed to update transfer as reversed');
    }

    return transfer;
};
