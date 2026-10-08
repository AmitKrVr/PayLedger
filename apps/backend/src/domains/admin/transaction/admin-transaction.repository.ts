import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';

import {
    db,
    ledgerEntries,
    transactions,
    users,
    wallets,
    WalletType,
    type DatabaseOrTransaction,
    type TransactionStatus,
    type TransactionType,
} from '@payledger/database';

export type ListTransactionsFilters = {
    search?: string;
    type?: TransactionType;
    status?: TransactionStatus;
    userId?: string;
    from?: Date;
    to?: Date;
    minAmountPaise?: bigint;
    maxAmountPaise?: bigint;
    page: number;
    limit: number;
};

/**
 * Every transaction has exactly one ledger leg touching its own
 * initiator's wallet (transactions.userId) -- the user's own deposit
 * credit, a sender's debit, a withdrawer's debit, or a reversal's credit
 * back to the original sender. Joining through that one leg gives a
 * single, unambiguous "amount"/"direction" per transaction without
 * fanning a multi-leg transfer out into several rows.
 */
const buildBaseQuery = (executor: DatabaseOrTransaction) =>
    executor
        .select({
            id: transactions.id,
            referenceId: transactions.referenceId,
            type: transactions.type,
            status: transactions.status,
            createdAt: transactions.createdAt,
            completedAt: transactions.completedAt,
            amountPaise: ledgerEntries.amountPaise,
            direction: ledgerEntries.direction,
            userId: users.id,
            userName: users.name,
            userMobile: users.mobile,
        })
        .from(transactions)
        .innerJoin(users, eq(transactions.userId, users.id))
        .innerJoin(
            wallets,
            and(eq(wallets.userId, users.id), eq(wallets.walletType, WalletType.USER)),
        )
        .innerJoin(
            ledgerEntries,
            and(
                eq(ledgerEntries.transactionId, transactions.id),
                eq(ledgerEntries.walletId, wallets.id),
            ),
        );

const buildTransactionConditions = (filters: ListTransactionsFilters) => {
    const conditions = [];

    if (filters.search) {
        const term = `%${filters.search}%`;
        conditions.push(
            or(
                ilike(transactions.referenceId, term),
                ilike(users.name, term),
                ilike(users.mobile, term),
            ),
        );
    }

    if (filters.type) {
        conditions.push(eq(transactions.type, filters.type));
    }

    if (filters.status) {
        conditions.push(eq(transactions.status, filters.status));
    }

    if (filters.userId) {
        conditions.push(eq(transactions.userId, filters.userId));
    }

    if (filters.from) {
        conditions.push(gte(transactions.createdAt, filters.from));
    }

    if (filters.to) {
        conditions.push(lte(transactions.createdAt, filters.to));
    }

    if (filters.minAmountPaise !== undefined) {
        conditions.push(gte(ledgerEntries.amountPaise, filters.minAmountPaise));
    }

    if (filters.maxAmountPaise !== undefined) {
        conditions.push(lte(ledgerEntries.amountPaise, filters.maxAmountPaise));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
};

export const findTransactions = async (
    filters: ListTransactionsFilters,
    executor: DatabaseOrTransaction = db,
) =>
    buildBaseQuery(executor)
        .where(buildTransactionConditions(filters))
        .orderBy(desc(transactions.createdAt), desc(transactions.id))
        .limit(filters.limit)
        .offset((filters.page - 1) * filters.limit);

export const countTransactions = async (
    filters: ListTransactionsFilters,
    executor: DatabaseOrTransaction = db,
): Promise<number> => {
    const [row] = await executor
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .innerJoin(users, eq(transactions.userId, users.id))
        .innerJoin(
            wallets,
            and(eq(wallets.userId, users.id), eq(wallets.walletType, WalletType.USER)),
        )
        .innerJoin(
            ledgerEntries,
            and(
                eq(ledgerEntries.transactionId, transactions.id),
                eq(ledgerEntries.walletId, wallets.id),
            ),
        )
        .where(buildTransactionConditions(filters));

    return row?.count ?? 0;
};

export const findTransactionByIdWithUser = async (
    id: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [row] = await buildBaseQuery(executor).where(eq(transactions.id, id)).limit(1);

    return row ?? null;
};

export const findLedgerEntriesForTransaction = async (
    transactionId: string,
    executor: DatabaseOrTransaction = db,
) =>
    executor
        .select({
            id: ledgerEntries.id,
            walletId: ledgerEntries.walletId,
            walletType: wallets.walletType,
            walletOwnerName: users.name,
            direction: ledgerEntries.direction,
            amountPaise: ledgerEntries.amountPaise,
            balanceBeforePaise: ledgerEntries.balanceBeforePaise,
            balanceAfterPaise: ledgerEntries.balanceAfterPaise,
        })
        .from(ledgerEntries)
        .innerJoin(wallets, eq(ledgerEntries.walletId, wallets.id))
        .leftJoin(users, eq(wallets.userId, users.id))
        .where(eq(ledgerEntries.transactionId, transactionId))
        .orderBy(ledgerEntries.createdAt);
