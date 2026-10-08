import { ERROR_CODES } from '../../../constants/response.constants.js';
import { paiseToInr } from '../../../lib/money.js';
import { NotFoundError } from '../../../middleware/error.middleware.js';

import {
    countUsers,
    findRecentPaymentsForUser,
    findRecentTransactionsForUser,
    findRecentWithdrawalsForUser,
    findUserById,
    findUsers,
    type ListUsersFilters,
} from './admin-user.repository.js';

type WalletSummary = {
    status: string;
    balance: number;
    held: number;
    available: number;
} | null;

const toWalletSummary = (row: {
    walletStatus: string | null;
    walletBalancePaise: bigint | null;
    walletHeldPaise: bigint | null;
}): WalletSummary => {
    if (!row.walletStatus || row.walletBalancePaise === null) {
        return null;
    }

    const balance = paiseToInr(row.walletBalancePaise);
    const held = paiseToInr(row.walletHeldPaise ?? 0n);

    return {
        status: row.walletStatus,
        balance,
        held,
        available: balance - held,
    };
};

export const listUsers = async (filters: ListUsersFilters) => {
    const [rows, totalItems] = await Promise.all([
        findUsers(filters),
        countUsers(filters),
    ]);

    return {
        items: rows.map((row) => ({
            id: row.id,
            name: row.name,
            mobile: row.mobile,
            email: row.email,
            status: row.status,
            createdAt: row.createdAt,
            wallet: toWalletSummary(row),
        })),
        totalItems,
    };
};

export const getUser = async (id: string) => {
    const row = await findUserById(id);

    if (!row) {
        throw new NotFoundError('User not found', ERROR_CODES.NOT_FOUND);
    }

    const [recentTransactions, recentPayments, recentWithdrawals] =
        await Promise.all([
            findRecentTransactionsForUser(id),
            findRecentPaymentsForUser(id),
            findRecentWithdrawalsForUser(id),
        ]);

    return {
        id: row.id,
        name: row.name,
        mobile: row.mobile,
        email: row.email,
        status: row.status,
        createdAt: row.createdAt,
        lastLoginAt: row.lastLoginAt,
        wallet: toWalletSummary(row),
        recentTransactions: recentTransactions.map((t) => ({
            id: t.id,
            reference: t.referenceId,
            type: t.type,
            status: t.status,
            createdAt: t.createdAt,
        })),
        recentPayments: recentPayments.map((p) => ({
            id: p.id,
            orderId: p.orderId,
            amount: paiseToInr(p.amountPaise),
            status: p.status,
            createdAt: p.createdAt,
        })),
        recentWithdrawals: recentWithdrawals.map((w) => ({
            id: w.id,
            amount: paiseToInr(w.amountPaise),
            status: w.status,
            requestedAt: w.requestedAt,
        })),
    };
};
