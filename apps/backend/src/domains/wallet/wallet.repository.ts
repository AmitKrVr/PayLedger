import { and, eq } from 'drizzle-orm';

import {
    db,
    ledgerEntries,
    wallets,
    WalletType,
    type DatabaseOrTransaction,
    type LedgerDirection,
} from '@payledger/database';

export const findWalletByUserId = async (
    userId: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [wallet] = await executor
        .select()
        .from(wallets)
        .where(
            and(
                eq(wallets.userId, userId),
                eq(wallets.walletType, WalletType.USER),
            ),
        )
        .limit(1);

    return wallet ?? null;
};

export const findWalletByIdForUpdate = async (
    walletId: string,
    executor: DatabaseOrTransaction,
) => {
    const [wallet] = await executor
        .select()
        .from(wallets)
        .where(eq(wallets.id, walletId))
        .for('update')
        .limit(1);

    return wallet ?? null;
};

export const updateWalletAfterCredit = async (
    walletId: string,
    data: {
        balancePaise: bigint;
        totalCreditedPaise: bigint;
    },
    executor: DatabaseOrTransaction,
) => {
    const [wallet] = await executor
        .update(wallets)
        .set({
            balancePaise: data.balancePaise,
            totalCreditedPaise: data.totalCreditedPaise,
            updatedAt: new Date(),
        })
        .where(eq(wallets.id, walletId))
        .returning();

    if (!wallet) {
        throw new Error('Failed to update wallet after credit');
    }

    return wallet;
};

export const updateWalletAfterDebit = async (
    walletId: string,
    data: {
        balancePaise: bigint;
        totalDebitedPaise: bigint;
    },
    executor: DatabaseOrTransaction,
) => {
    const [wallet] = await executor
        .update(wallets)
        .set({
            balancePaise: data.balancePaise,
            totalDebitedPaise: data.totalDebitedPaise,
            updatedAt: new Date(),
        })
        .where(eq(wallets.id, walletId))
        .returning();

    if (!wallet) {
        throw new Error('Failed to update wallet after debit');
    }

    return wallet;
};

export const updateWalletHeld = async (
    walletId: string,
    heldPaise: bigint,
    executor: DatabaseOrTransaction,
) => {
    const [wallet] = await executor
        .update(wallets)
        .set({
            heldPaise,
            updatedAt: new Date(),
        })
        .where(eq(wallets.id, walletId))
        .returning();

    if (!wallet) {
        throw new Error('Failed to update wallet hold');
    }

    return wallet;
};

export const createLedgerEntry = async (
    data: {
        transactionId: string;
        walletId: string;
        amountPaise: bigint;
        direction: LedgerDirection;
        balanceBeforePaise: bigint;
        balanceAfterPaise: bigint;
    },
    executor: DatabaseOrTransaction,
) => {
    const [entry] = await executor
        .insert(ledgerEntries)
        .values(data)
        .returning();

    if (!entry) {
        throw new Error('Failed to create ledger entry');
    }

    return entry;
};
