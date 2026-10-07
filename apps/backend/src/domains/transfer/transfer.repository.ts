import { and, eq, gte, lt, sql } from 'drizzle-orm';

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
    WalletType,
    type DatabaseOrTransaction,
} from '@payledger/database';

export const findSystemWallet = async (
    executor: DatabaseOrTransaction = db,
) => {
    const [wallet] = await executor
        .select()
        .from(wallets)
        .where(eq(wallets.walletType, WalletType.SYSTEM))
        .limit(1);

    return wallet ?? null;
};

/**
 * Joins through to the transaction (for its referenceId) and the
 * receiver's user (for the name shown in a replayed response) so an
 * idempotent repeat can be answered without extra round trips.
 */
export const findTransferBySenderAndIdempotencyKey = async (
    senderWalletId: string,
    idempotencyKey: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [row] = await executor
        .select({
            transfer: transfers,
            referenceId: transactions.referenceId,
            recipientUserId: users.id,
            recipientName: users.name,
        })
        .from(transfers)
        .innerJoin(
            transactions,
            eq(transfers.transactionId, transactions.id),
        )
        .innerJoin(wallets, eq(transfers.receiverWalletId, wallets.id))
        .innerJoin(users, eq(wallets.userId, users.id))
        .where(
            and(
                eq(transfers.senderWalletId, senderWalletId),
                eq(transfers.idempotencyKey, idempotencyKey),
            ),
        )
        .limit(1);

    return row ?? null;
};

/** Sum of COMPLETED transfer amounts (not fees) for a sender wallet within [startUtc, endUtc). */
export const getDailyCompletedTransferAmount = async (
    senderWalletId: string,
    startUtc: Date,
    endUtc: Date,
    executor: DatabaseOrTransaction,
): Promise<bigint> => {
    const [row] = await executor
        .select({
            total: sql<string>`coalesce(sum(${transfers.amountPaise}), 0)`,
        })
        .from(transfers)
        .where(
            and(
                eq(transfers.senderWalletId, senderWalletId),
                eq(transfers.status, TransferStatus.COMPLETED),
                gte(transfers.createdAt, startUtc),
                lt(transfers.createdAt, endUtc),
            ),
        );

    return BigInt(row?.total ?? '0');
};

export const createTransferTransaction = async (
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
            type: TransactionType.TRANSFER,
            status: TransactionStatus.COMPLETED,
            userId: data.userId,
            sourceType: TransactionSourceType.TRANSFER,
            sourceId: data.sourceId,
            description: data.description,
            completedAt: new Date(),
        })
        .returning();

    if (!transaction) {
        throw new Error('Failed to create transfer transaction');
    }

    return transaction;
};

export const createTransfer = async (
    data: {
        id: string;
        transactionId: string;
        senderWalletId: string;
        receiverWalletId: string;
        amountPaise: bigint;
        feePaise: bigint;
        totalPaise: bigint;
        idempotencyKey: string;
    },
    executor: DatabaseOrTransaction,
) => {
    const [transfer] = await executor
        .insert(transfers)
        .values({
            id: data.id,
            transactionId: data.transactionId,
            senderWalletId: data.senderWalletId,
            receiverWalletId: data.receiverWalletId,
            amountPaise: data.amountPaise,
            feePaise: data.feePaise,
            totalPaise: data.totalPaise,
            idempotencyKey: data.idempotencyKey,
            status: TransferStatus.COMPLETED,
            completedAt: new Date(),
        })
        .returning();

    if (!transfer) {
        throw new Error('Failed to create transfer');
    }

    return transfer;
};
