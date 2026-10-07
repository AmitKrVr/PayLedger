import { and, eq } from 'drizzle-orm';

import {
    db,
    withdrawals,
    WithdrawalStatus,
    type DatabaseOrTransaction,
} from '@payledger/database';

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
