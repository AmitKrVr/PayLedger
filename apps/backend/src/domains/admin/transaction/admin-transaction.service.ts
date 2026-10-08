import { ERROR_CODES } from '../../../constants/response.constants.js';
import { inrToPaise, paiseToInr } from '../../../lib/money.js';
import { NotFoundError } from '../../../middleware/error.middleware.js';

import {
    countTransactions,
    findLedgerEntriesForTransaction,
    findTransactionByIdWithUser,
    findTransactions,
    type ListTransactionsFilters,
} from './admin-transaction.repository.js';
import type { ListTransactionsQuery } from './admin-transaction.validator.js';

export const listTransactions = async (query: ListTransactionsQuery) => {
    const filters: ListTransactionsFilters = {
        search: query.search,
        type: query.type,
        status: query.status,
        userId: query.userId,
        from: query.from,
        to: query.to,
        minAmountPaise:
            query.minAmount !== undefined ? inrToPaise(query.minAmount) : undefined,
        maxAmountPaise:
            query.maxAmount !== undefined ? inrToPaise(query.maxAmount) : undefined,
        page: query.page,
        limit: query.limit,
    };

    const [rows, totalItems] = await Promise.all([
        findTransactions(filters),
        countTransactions(filters),
    ]);

    return {
        items: rows.map((row) => ({
            id: row.id,
            reference: row.referenceId,
            type: row.type,
            status: row.status,
            user: { id: row.userId, name: row.userName, mobile: row.userMobile },
            amount: paiseToInr(row.amountPaise),
            direction: row.direction,
            createdAt: row.createdAt,
            completedAt: row.completedAt,
        })),
        totalItems,
    };
};

export const getTransaction = async (id: string) => {
    const row = await findTransactionByIdWithUser(id);

    if (!row) {
        throw new NotFoundError('Transaction not found', ERROR_CODES.NOT_FOUND);
    }

    const ledgerRows = await findLedgerEntriesForTransaction(id);

    return {
        id: row.id,
        reference: row.referenceId,
        type: row.type,
        status: row.status,
        user: { id: row.userId, name: row.userName, mobile: row.userMobile },
        amount: paiseToInr(row.amountPaise),
        direction: row.direction,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
        ledgerEntries: ledgerRows.map((entry) => ({
            id: entry.id,
            wallet:
                entry.walletType === 'SYSTEM'
                    ? 'System wallet'
                    : (entry.walletOwnerName ?? 'Unknown'),
            direction: entry.direction,
            amount: paiseToInr(entry.amountPaise),
            currency: 'INR',
            balanceBefore: paiseToInr(entry.balanceBeforePaise),
            balanceAfter: paiseToInr(entry.balanceAfterPaise),
        })),
    };
};
