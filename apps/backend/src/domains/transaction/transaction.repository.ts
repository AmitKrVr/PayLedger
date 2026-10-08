import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import {
    db,
    ledgerEntries,
    transactions,
    transfers,
    users,
    wallets,
    type DatabaseOrTransaction,
    type TransactionStatus,
    type TransactionType,
} from '@payledger/database';

export type TransactionFilters = {
    type?: TransactionType;
    status?: TransactionStatus;
    from?: Date;
    to?: Date;
};

/**
 * A user's transaction history is defined by ownership of the *ledger*
 * movement, not `transactions.userId` (which only ever names the
 * transaction's initiator, e.g. a transfer's sender) — joining through
 * `ledger_entries` + `wallets` is what lets the receiving side of a
 * transfer see it in their own history too.
 */
const buildOwnershipConditions = (
    userId: string,
    filters: TransactionFilters,
) => {
    const conditions = [eq(wallets.userId, userId)];

    if (filters.type) {
        conditions.push(eq(transactions.type, filters.type));
    }

    if (filters.status) {
        conditions.push(eq(transactions.status, filters.status));
    }

    if (filters.from) {
        conditions.push(gte(transactions.createdAt, filters.from));
    }

    if (filters.to) {
        conditions.push(lte(transactions.createdAt, filters.to));
    }

    return and(...conditions);
};

export const findTransactionsForUser = async (
    userId: string,
    filters: TransactionFilters,
    pagination: { page: number; limit: number },
    executor: DatabaseOrTransaction = db,
) => {
    return executor
        .select({
            id: transactions.id,
            referenceId: transactions.referenceId,
            type: transactions.type,
            status: transactions.status,
            sourceType: transactions.sourceType,
            sourceId: transactions.sourceId,
            description: transactions.description,
            createdAt: transactions.createdAt,
            completedAt: transactions.completedAt,
            walletId: ledgerEntries.walletId,
            amountPaise: ledgerEntries.amountPaise,
            direction: ledgerEntries.direction,
        })
        .from(transactions)
        .innerJoin(
            ledgerEntries,
            eq(ledgerEntries.transactionId, transactions.id),
        )
        .innerJoin(wallets, eq(wallets.id, ledgerEntries.walletId))
        .where(buildOwnershipConditions(userId, filters))
        .orderBy(desc(transactions.createdAt), desc(transactions.id))
        .limit(pagination.limit)
        .offset((pagination.page - 1) * pagination.limit);
};

export const countTransactionsForUser = async (
    userId: string,
    filters: TransactionFilters,
    executor: DatabaseOrTransaction = db,
): Promise<number> => {
    const [row] = await executor
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .innerJoin(
            ledgerEntries,
            eq(ledgerEntries.transactionId, transactions.id),
        )
        .innerJoin(wallets, eq(wallets.id, ledgerEntries.walletId))
        .where(buildOwnershipConditions(userId, filters));

    return row?.count ?? 0;
};

export const findTransactionByIdForUser = async (
    id: string,
    userId: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [row] = await executor
        .select({
            id: transactions.id,
            referenceId: transactions.referenceId,
            type: transactions.type,
            status: transactions.status,
            sourceType: transactions.sourceType,
            sourceId: transactions.sourceId,
            description: transactions.description,
            createdAt: transactions.createdAt,
            completedAt: transactions.completedAt,
            walletId: ledgerEntries.walletId,
            amountPaise: ledgerEntries.amountPaise,
            direction: ledgerEntries.direction,
        })
        .from(transactions)
        .innerJoin(
            ledgerEntries,
            eq(ledgerEntries.transactionId, transactions.id),
        )
        .innerJoin(wallets, eq(wallets.id, ledgerEntries.walletId))
        .where(and(eq(transactions.id, id), eq(wallets.userId, userId)))
        .limit(1);

    return row ?? null;
};

const senderWallets = alias(wallets, 'th_sender_wallets');
const receiverWallets = alias(wallets, 'th_receiver_wallets');
const senderUsers = alias(users, 'th_sender_users');
const receiverUsers = alias(users, 'th_receiver_users');

/**
 * Batch-resolves counterparty (sender/receiver) identity for a page of
 * TRANSFER / TRANSFER_REVERSAL rows in one query, keyed by transfer id —
 * avoids an N+1 lookup per row.
 */
export const findTransferCounterparties = async (
    transferIds: string[],
    executor: DatabaseOrTransaction = db,
) => {
    if (transferIds.length === 0) {
        return [];
    }

    return executor
        .select({
            transferId: transfers.id,
            senderWalletId: transfers.senderWalletId,
            receiverWalletId: transfers.receiverWalletId,
            senderUserId: senderUsers.id,
            senderName: senderUsers.name,
            receiverUserId: receiverUsers.id,
            receiverName: receiverUsers.name,
        })
        .from(transfers)
        .innerJoin(
            senderWallets,
            eq(transfers.senderWalletId, senderWallets.id),
        )
        .innerJoin(senderUsers, eq(senderWallets.userId, senderUsers.id))
        .innerJoin(
            receiverWallets,
            eq(transfers.receiverWalletId, receiverWallets.id),
        )
        .innerJoin(receiverUsers, eq(receiverWallets.userId, receiverUsers.id))
        .where(inArray(transfers.id, transferIds));
};
