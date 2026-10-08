import { paiseToInr } from '../../../lib/money.js';

import { getIstDayRangeUtc } from '../../transfer/transfer.service.js';
import { findPayments } from '../payment/admin-payment.repository.js';
import { findTransfers } from '../transfer/admin-transfer.repository.js';
import { findWithdrawals } from '../withdrawal/admin-withdrawal.repository.js';

import {
    countAllUsers,
    getPendingPaymentsCount,
    getPendingWithdrawalStats,
    getTodaysDepositStats,
    getTodaysTransferStats,
    sumUserWalletBalance,
} from './admin-dashboard.repository.js';

const RECENT_ACTIVITY_LIMIT = 5;

export const getDashboard = async () => {
    const { startUtc, endUtc } = getIstDayRangeUtc();

    const [
        totalUsers,
        totalWalletBalancePaise,
        pendingWithdrawals,
        pendingPaymentsCount,
        todaysDeposits,
        todaysTransfers,
        recentPayments,
        recentTransfers,
        recentWithdrawals,
    ] = await Promise.all([
        countAllUsers(),
        sumUserWalletBalance(),
        getPendingWithdrawalStats(),
        getPendingPaymentsCount(),
        getTodaysDepositStats(startUtc, endUtc),
        getTodaysTransferStats(startUtc, endUtc),
        findPayments({ page: 1, limit: RECENT_ACTIVITY_LIMIT }),
        findTransfers({ page: 1, limit: RECENT_ACTIVITY_LIMIT }),
        findWithdrawals({ page: 1, limit: RECENT_ACTIVITY_LIMIT }),
    ]);

    return {
        stats: {
            totalUsers,
            totalWalletBalance: paiseToInr(totalWalletBalancePaise),
            pendingWithdrawals: {
                count: pendingWithdrawals.count,
                amount: paiseToInr(pendingWithdrawals.amountPaise),
            },
            pendingPayments: pendingPaymentsCount,
            todaysDeposits: {
                count: todaysDeposits.count,
                amount: paiseToInr(todaysDeposits.amountPaise),
            },
            todaysTransfers: {
                count: todaysTransfers.count,
                amount: paiseToInr(todaysTransfers.amountPaise),
            },
        },
        recentPayments: recentPayments.map((row) => ({
            id: row.id,
            orderId: row.orderId,
            user: { id: row.userId, name: row.userName, mobile: row.userMobile },
            amount: paiseToInr(row.amountPaise),
            status: row.status,
            createdAt: row.createdAt,
        })),
        recentTransfers: recentTransfers.map((row) => ({
            id: row.id,
            reference: row.referenceId,
            sender: { id: row.senderUserId, name: row.senderName, mobile: row.senderMobile },
            recipient: {
                id: row.receiverUserId,
                name: row.receiverName,
                mobile: row.receiverMobile,
            },
            amount: paiseToInr(row.amountPaise),
            status: row.status,
            createdAt: row.createdAt,
        })),
        recentWithdrawals: recentWithdrawals.map((row) => ({
            id: row.id,
            user: { id: row.userId, name: row.userName, mobile: row.userMobile },
            amount: paiseToInr(row.amountPaise),
            status: row.status,
            requestedAt: row.requestedAt,
        })),
    };
};
