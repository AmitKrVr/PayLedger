import {
    LedgerDirection,
    WalletStatus,
    type DatabaseOrTransaction,
} from '@payledger/database';

import { ERROR_CODES } from '../../constants/response.constants.js';
import { ERROR_MESSAGES } from '../../constants/message.constants.js';
import {
    BusinessRuleError,
    NotFoundError,
} from '../../middleware/error.middleware.js';

import {
    createLedgerEntry,
    findWalletByIdForUpdate,
    updateWalletAfterCredit,
    updateWalletAfterDebit,
    updateWalletHeld,
} from './wallet.repository.js';
import type {
    CreditWalletInput,
    DebitWalletInput,
    HoldWalletInput,
    ReleaseWalletHoldInput,
} from './wallet.types.js';

const assertPositiveAmount = (amountPaise: bigint): void => {
    if (amountPaise <= 0n) {
        throw new BusinessRuleError(
            ERROR_MESSAGES.INVALID_AMOUNT,
            ERROR_CODES.INVALID_AMOUNT,
        );
    }
};

/**
 * Every wallet mutation starts here: lock the row (caller's transaction),
 * confirm it exists and is eligible for financial operations. Callers must
 * never read a wallet's balance/held amount outside of this lock.
 */
const lockEligibleWallet = async (
    walletId: string,
    tx: DatabaseOrTransaction,
) => {
    const wallet = await findWalletByIdForUpdate(walletId, tx);

    if (!wallet) {
        throw new NotFoundError(
            ERROR_MESSAGES.WALLET_NOT_FOUND,
            ERROR_CODES.WALLET_NOT_FOUND,
        );
    }

    if (wallet.status !== WalletStatus.ACTIVE) {
        throw new BusinessRuleError(
            ERROR_MESSAGES.WALLET_BLOCKED,
            ERROR_CODES.WALLET_BLOCKED,
        );
    }

    return wallet;
};

export const creditWallet = async ({
    walletId,
    amountPaise,
    transactionId,
    tx,
}: CreditWalletInput): Promise<void> => {
    assertPositiveAmount(amountPaise);

    const wallet = await lockEligibleWallet(walletId, tx);

    const balanceBeforePaise = wallet.balancePaise;
    const balanceAfterPaise = balanceBeforePaise + amountPaise;

    await updateWalletAfterCredit(
        walletId,
        {
            balancePaise: balanceAfterPaise,
            totalCreditedPaise: wallet.totalCreditedPaise + amountPaise,
        },
        tx,
    );

    await createLedgerEntry(
        {
            transactionId,
            walletId,
            amountPaise,
            direction: LedgerDirection.CREDIT,
            balanceBeforePaise,
            balanceAfterPaise,
        },
        tx,
    );
};

export const debitWallet = async ({
    walletId,
    amountPaise,
    transactionId,
    tx,
}: DebitWalletInput): Promise<void> => {
    assertPositiveAmount(amountPaise);

    const wallet = await lockEligibleWallet(walletId, tx);

    const availablePaise = wallet.balancePaise - wallet.heldPaise;

    if (availablePaise < amountPaise) {
        throw new BusinessRuleError(
            ERROR_MESSAGES.INSUFFICIENT_BALANCE,
            ERROR_CODES.INSUFFICIENT_BALANCE,
        );
    }

    const balanceBeforePaise = wallet.balancePaise;
    const balanceAfterPaise = balanceBeforePaise - amountPaise;

    await updateWalletAfterDebit(
        walletId,
        {
            balancePaise: balanceAfterPaise,
            totalDebitedPaise: wallet.totalDebitedPaise + amountPaise,
        },
        tx,
    );

    await createLedgerEntry(
        {
            transactionId,
            walletId,
            amountPaise,
            direction: LedgerDirection.DEBIT,
            balanceBeforePaise,
            balanceAfterPaise,
        },
        tx,
    );
};

export const holdWallet = async ({
    walletId,
    amountPaise,
    tx,
}: HoldWalletInput): Promise<void> => {
    assertPositiveAmount(amountPaise);

    const wallet = await lockEligibleWallet(walletId, tx);

    const newHeldPaise = wallet.heldPaise + amountPaise;

    if (newHeldPaise > wallet.balancePaise) {
        throw new BusinessRuleError(
            ERROR_MESSAGES.INSUFFICIENT_BALANCE,
            ERROR_CODES.INSUFFICIENT_BALANCE,
        );
    }

    await updateWalletHeld(walletId, newHeldPaise, tx);
};

export const releaseWalletHold = async ({
    walletId,
    amountPaise,
    tx,
}: ReleaseWalletHoldInput): Promise<void> => {
    assertPositiveAmount(amountPaise);

    const wallet = await lockEligibleWallet(walletId, tx);

    if (wallet.heldPaise < amountPaise) {
        throw new BusinessRuleError(
            ERROR_MESSAGES.INSUFFICIENT_HELD_AMOUNT,
            ERROR_CODES.INSUFFICIENT_HELD_AMOUNT,
        );
    }

    await updateWalletHeld(walletId, wallet.heldPaise - amountPaise, tx);
};
