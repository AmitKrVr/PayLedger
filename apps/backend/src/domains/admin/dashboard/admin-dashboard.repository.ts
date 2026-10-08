import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';

import {
    db,
    payments,
    transfers,
    users,
    wallets,
    withdrawals,
    PaymentStatus,
    TransferStatus,
    WalletType,
    WithdrawalStatus,
    type DatabaseOrTransaction,
} from '@payledger/database';

export const countAllUsers = async (
    executor: DatabaseOrTransaction = db,
): Promise<number> => {
    const [row] = await executor
        .select({ count: sql<number>`count(*)::int` })
        .from(users);

    return row?.count ?? 0;
};

export const sumUserWalletBalance = async (
    executor: DatabaseOrTransaction = db,
): Promise<bigint> => {
    const [row] = await executor
        .select({ total: sql<string>`coalesce(sum(${wallets.balancePaise}), 0)` })
        .from(wallets)
        .where(eq(wallets.walletType, WalletType.USER));

    return BigInt(row?.total ?? '0');
};

export const getPendingWithdrawalStats = async (
    executor: DatabaseOrTransaction = db,
): Promise<{ count: number; amountPaise: bigint }> => {
    const [row] = await executor
        .select({
            count: sql<number>`count(*)::int`,
            total: sql<string>`coalesce(sum(${withdrawals.amountPaise}), 0)`,
        })
        .from(withdrawals)
        .where(eq(withdrawals.status, WithdrawalStatus.PENDING));

    return { count: row?.count ?? 0, amountPaise: BigInt(row?.total ?? '0') };
};

export const getPendingPaymentsCount = async (
    executor: DatabaseOrTransaction = db,
): Promise<number> => {
    const [row] = await executor
        .select({ count: sql<number>`count(*)::int` })
        .from(payments)
        .where(
            inArray(payments.status, [
                PaymentStatus.CREATED,
                PaymentStatus.PROCESSING,
            ]),
        );

    return row?.count ?? 0;
};

export const getTodaysDepositStats = async (
    startUtc: Date,
    endUtc: Date,
    executor: DatabaseOrTransaction = db,
): Promise<{ count: number; amountPaise: bigint }> => {
    const [row] = await executor
        .select({
            count: sql<number>`count(*)::int`,
            total: sql<string>`coalesce(sum(${payments.amountPaise}), 0)`,
        })
        .from(payments)
        .where(
            and(
                eq(payments.status, PaymentStatus.SUCCESS),
                gte(payments.paidAt, startUtc),
                lt(payments.paidAt, endUtc),
            ),
        );

    return { count: row?.count ?? 0, amountPaise: BigInt(row?.total ?? '0') };
};

export const getTodaysTransferStats = async (
    startUtc: Date,
    endUtc: Date,
    executor: DatabaseOrTransaction = db,
): Promise<{ count: number; amountPaise: bigint }> => {
    const [row] = await executor
        .select({
            count: sql<number>`count(*)::int`,
            total: sql<string>`coalesce(sum(${transfers.amountPaise}), 0)`,
        })
        .from(transfers)
        .where(
            and(
                eq(transfers.status, TransferStatus.COMPLETED),
                gte(transfers.completedAt, startUtc),
                lt(transfers.completedAt, endUtc),
            ),
        );

    return { count: row?.count ?? 0, amountPaise: BigInt(row?.total ?? '0') };
};
