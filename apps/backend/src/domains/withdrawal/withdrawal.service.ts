import { db, WalletStatus, type WithdrawalStatus } from '@payledger/database';

import { ERROR_CODES } from '../../constants/response.constants.js';
import { ERROR_MESSAGES } from '../../constants/message.constants.js';
import { inrToPaise, paiseToInr } from '../../lib/money.js';
import {
    BusinessRuleError,
    NotFoundError,
} from '../../middleware/error.middleware.js';

import { holdWallet } from '../wallet/wallet.operations.js';
import {
    findWalletByIdForUpdate,
    findWalletByUserId,
} from '../wallet/wallet.repository.js';

import {
    countWithdrawalsForUser,
    createWithdrawal as createWithdrawalRecord,
    findWithdrawalByIdForUser,
    findWithdrawalByWalletAndIdempotencyKey,
    findWithdrawalsForUser,
} from './withdrawal.repository.js';
import {
    idempotencyKeyHeaderSchema,
    type CreateWithdrawalInput,
} from './withdrawal.validator.js';

type WithdrawalResponse = {
    id: string;
    amount: number;
    status: WithdrawalStatus;
    requestedAt: Date;
};

type WithdrawalRow = {
    id: string;
    amountPaise: bigint;
    status: WithdrawalStatus;
    requestedAt: Date;
};

const toWithdrawalResponse = (
    withdrawal: WithdrawalRow,
): WithdrawalResponse => ({
    id: withdrawal.id,
    amount: paiseToInr(withdrawal.amountPaise),
    status: withdrawal.status,
    requestedAt: withdrawal.requestedAt,
});

type WithdrawalHistoryRow = {
    id: string;
    referenceId: string | null;
    amountPaise: bigint;
    status: WithdrawalStatus;
    createdAt: Date;
    updatedAt: Date;
    processedAt: Date | null;
    rejectionReason: string | null;
};

type WithdrawalHistoryItem = {
    id: string;
    reference: string | null;
    amount: number;
    status: WithdrawalStatus;
    createdAt: Date;
    updatedAt: Date;
    processedAt: Date | null;
    rejectionReason: string | null;
};

const toWithdrawalHistoryItem = (
    row: WithdrawalHistoryRow,
): WithdrawalHistoryItem => ({
    id: row.id,
    reference: row.referenceId,
    amount: paiseToInr(row.amountPaise),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    processedAt: row.processedAt,
    rejectionReason: row.rejectionReason,
});

export const listWithdrawals = async (
    userId: string,
    filters: { status?: WithdrawalStatus; page: number; limit: number },
): Promise<{ items: WithdrawalHistoryItem[]; totalItems: number }> => {
    const [rows, totalItems] = await Promise.all([
        findWithdrawalsForUser(userId, filters),
        countWithdrawalsForUser(userId, { status: filters.status }),
    ]);

    return {
        items: rows.map(toWithdrawalHistoryItem),
        totalItems,
    };
};

export const getWithdrawal = async (
    id: string,
    userId: string,
): Promise<WithdrawalHistoryItem> => {
    const row = await findWithdrawalByIdForUser(id, userId);

    if (!row) {
        throw new NotFoundError('Withdrawal not found', ERROR_CODES.NOT_FOUND);
    }

    return toWithdrawalHistoryItem(row);
};

const isUniqueViolation = (error: unknown): boolean => {
    const code =
        (error as { cause?: { code?: string } })?.cause?.code ??
        (error as { code?: string })?.code;

    return code === '23505';
};

export const createWithdrawal = async (
    userId: string,
    input: CreateWithdrawalInput,
    idempotencyKeyHeader: string | undefined,
): Promise<WithdrawalResponse> => {
    const { 'idempotency-key': idempotencyKey } =
        idempotencyKeyHeaderSchema.parse({
            'idempotency-key': idempotencyKeyHeader,
        });

    const wallet = await findWalletByUserId(userId);

    if (!wallet) {
        throw new NotFoundError(
            ERROR_MESSAGES.WALLET_NOT_FOUND,
            ERROR_CODES.WALLET_NOT_FOUND,
        );
    }

    const existing = await findWithdrawalByWalletAndIdempotencyKey(
        wallet.id,
        idempotencyKey,
    );

    if (existing) {
        return toWithdrawalResponse(existing);
    }

    const amountPaise = inrToPaise(input.amount);

    try {
        const result = await db.transaction(
            async (tx): Promise<WithdrawalResponse> => {
                const lockedWallet = await findWalletByIdForUpdate(
                    wallet.id,
                    tx,
                );

                if (!lockedWallet) {
                    throw new NotFoundError(
                        ERROR_MESSAGES.WALLET_NOT_FOUND,
                        ERROR_CODES.WALLET_NOT_FOUND,
                    );
                }

                if (lockedWallet.status !== WalletStatus.ACTIVE) {
                    throw new BusinessRuleError(
                        ERROR_MESSAGES.WALLET_BLOCKED,
                        ERROR_CODES.WALLET_BLOCKED,
                    );
                }

                // Now that the wallet row is locked, re-check idempotency:
                // a concurrent duplicate request may have committed while
                // we were waiting for this very lock.
                const committedWhileWaiting =
                    await findWithdrawalByWalletAndIdempotencyKey(
                        wallet.id,
                        idempotencyKey,
                        tx,
                    );

                if (committedWhileWaiting) {
                    return toWithdrawalResponse(committedWhileWaiting);
                }

                // holdWallet() re-locks (re-entrant, harmless) and enforces
                // available (balance - held) >= amountPaise itself; no
                // separate balance check is duplicated here.
                await holdWallet({
                    walletId: wallet.id,
                    amountPaise,
                    tx,
                });

                const withdrawal = await createWithdrawalRecord(
                    {
                        walletId: wallet.id,
                        amountPaise,
                        idempotencyKey,
                    },
                    tx,
                );

                return toWithdrawalResponse(withdrawal);
            },
        );

        return result;
    } catch (error) {
        // Final safety net: two requests that both passed every check
        // above and raced to this exact insert. The loser's hold has
        // already been rolled back by Postgres along with everything
        // else in its transaction — re-fetch and return the winner.
        if (isUniqueViolation(error)) {
            const existingAfterRace =
                await findWithdrawalByWalletAndIdempotencyKey(
                    wallet.id,
                    idempotencyKey,
                );

            if (existingAfterRace) {
                return toWithdrawalResponse(existingAfterRace);
            }
        }

        throw error;
    }
};
