import { randomUUID } from 'node:crypto';

import { env } from '@payledger/config';
import { db, WalletStatus, type TransferStatus } from '@payledger/database';
import { generateBusinessId } from '@payledger/shared';

import { ERROR_CODES } from '../../constants/response.constants.js';
import { ERROR_MESSAGES } from '../../constants/message.constants.js';
import { inrToPaise, paiseToInr } from '../../lib/money.js';
import {
    BusinessRuleError,
    DatabaseError,
    NotFoundError,
} from '../../middleware/error.middleware.js';

import { findUserById, findUserByMobile } from '../auth/auth.repository.js';
import { creditWallet, debitWallet } from '../wallet/wallet.operations.js';
import {
    findWalletByIdForUpdate,
    findWalletByUserId,
} from '../wallet/wallet.repository.js';

import {
    createTransfer as createTransferRecord,
    createTransferTransaction,
    findSystemWallet,
    findTransferBySenderAndIdempotencyKey,
    getDailyCompletedTransferAmount,
} from './transfer.repository.js';
import {
    idempotencyKeyHeaderSchema,
    type CreateTransferInput,
} from './transfer.validator.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * The [start, end) UTC instants covering "today" on the IST calendar,
 * computed from pure epoch-millisecond arithmetic so the result never
 * depends on the server/DB's own timezone setting. IST has no DST, so a
 * fixed +5:30 offset is always correct.
 */
export const getIstDayRangeUtc = (): { startUtc: Date; endUtc: Date } => {
    const istNow = new Date(Date.now() + IST_OFFSET_MS);
    const istMidnightUtcMs = Date.UTC(
        istNow.getUTCFullYear(),
        istNow.getUTCMonth(),
        istNow.getUTCDate(),
    );
    const startUtc = new Date(istMidnightUtcMs - IST_OFFSET_MS);
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

    return { startUtc, endUtc };
};

const calculateFeePaise = (amountPaise: bigint): bigint => {
    const rawFeePaise =
        (amountPaise * BigInt(env.TRANSFER_FEE_PERCENT)) / 100n;
    const minFeePaise = inrToPaise(env.TRANSFER_FEE_MIN_INR);
    const maxFeePaise = inrToPaise(env.TRANSFER_FEE_MAX_INR);

    if (rawFeePaise < minFeePaise) {
        return minFeePaise;
    }

    if (rawFeePaise > maxFeePaise) {
        return maxFeePaise;
    }

    return rawFeePaise;
};

const isUniqueViolation = (error: unknown): boolean => {
    const code =
        (error as { cause?: { code?: string } })?.cause?.code ??
        (error as { code?: string })?.code;

    return code === '23505';
};

type RecipientSummary = {
    userId: string;
    name: string;
};

type TransferResponse = {
    id: string;
    referenceId: string;
    recipient: RecipientSummary;
    amount: number;
    fee: number;
    total: number;
    status: TransferStatus;
    createdAt: Date;
};

type ReplayRow = NonNullable<
    Awaited<ReturnType<typeof findTransferBySenderAndIdempotencyKey>>
>;

const toReplayResponse = (row: ReplayRow): TransferResponse => ({
    id: row.transfer.id,
    referenceId: row.referenceId,
    recipient: { userId: row.recipientUserId, name: row.recipientName },
    amount: paiseToInr(row.transfer.amountPaise),
    fee: paiseToInr(row.transfer.feePaise),
    total: paiseToInr(row.transfer.totalPaise),
    status: row.transfer.status,
    createdAt: row.transfer.createdAt,
});

/**
 * Independently re-verifies a recipient is a real, eligible USER wallet
 * owner. Called both by the lookup step and, separately, right before a
 * transfer actually moves money — a recipient found eligible a moment ago
 * may have been blocked since, so this is never trusted from the caller.
 */
const verifyRecipient = async (
    recipientUserId: string,
): Promise<RecipientSummary> => {
    const recipientUser = await findUserById(recipientUserId);

    if (!recipientUser) {
        throw new NotFoundError('Recipient not found', ERROR_CODES.NOT_FOUND);
    }

    const recipientWallet = await findWalletByUserId(recipientUserId);

    if (!recipientWallet) {
        throw new NotFoundError(
            ERROR_MESSAGES.WALLET_NOT_FOUND,
            ERROR_CODES.WALLET_NOT_FOUND,
        );
    }

    if (recipientWallet.status !== WalletStatus.ACTIVE) {
        throw new BusinessRuleError(
            ERROR_MESSAGES.WALLET_BLOCKED,
            ERROR_CODES.WALLET_BLOCKED,
        );
    }

    return { userId: recipientUser.id, name: recipientUser.name };
};

export const lookupRecipient = async (
    senderUserId: string,
    mobile: string,
): Promise<RecipientSummary> => {
    const recipientUser = await findUserByMobile(mobile);

    if (!recipientUser) {
        throw new NotFoundError('Recipient not found', ERROR_CODES.NOT_FOUND);
    }

    if (recipientUser.id === senderUserId) {
        throw new BusinessRuleError('You cannot transfer money to yourself');
    }

    return verifyRecipient(recipientUser.id);
};

export const createTransfer = async (
    senderUserId: string,
    input: CreateTransferInput,
    idempotencyKeyHeader: string | undefined,
): Promise<TransferResponse> => {
    const { 'idempotency-key': idempotencyKey } =
        idempotencyKeyHeaderSchema.parse({
            'idempotency-key': idempotencyKeyHeader,
        });

    if (input.recipientUserId === senderUserId) {
        throw new BusinessRuleError('You cannot transfer money to yourself');
    }

    const senderWallet = await findWalletByUserId(senderUserId);

    if (!senderWallet) {
        throw new NotFoundError(
            ERROR_MESSAGES.WALLET_NOT_FOUND,
            ERROR_CODES.WALLET_NOT_FOUND,
        );
    }

    const existing = await findTransferBySenderAndIdempotencyKey(
        senderWallet.id,
        idempotencyKey,
    );

    if (existing) {
        return toReplayResponse(existing);
    }

    // The client only sent recipientUserId — never trust the earlier
    // /recipient lookup, re-verify everything about them fresh.
    const recipient = await verifyRecipient(input.recipientUserId);

    const systemWallet = await findSystemWallet();

    if (!systemWallet) {
        throw new DatabaseError('System wallet is not configured');
    }

    const amountPaise = inrToPaise(input.amount);
    const feePaise = calculateFeePaise(amountPaise);
    const totalPaise = amountPaise + feePaise;
    const transferId = randomUUID();
    const referenceId = generateBusinessId();

    try {
        const result = await db.transaction(
            async (tx): Promise<TransferResponse> => {
                const lockedSenderWallet = await findWalletByIdForUpdate(
                    senderWallet.id,
                    tx,
                );

                if (!lockedSenderWallet) {
                    throw new NotFoundError(
                        ERROR_MESSAGES.WALLET_NOT_FOUND,
                        ERROR_CODES.WALLET_NOT_FOUND,
                    );
                }

                if (lockedSenderWallet.status !== WalletStatus.ACTIVE) {
                    throw new BusinessRuleError(
                        ERROR_MESSAGES.WALLET_BLOCKED,
                        ERROR_CODES.WALLET_BLOCKED,
                    );
                }

                // Now that the sender row is locked, re-check idempotency:
                // a concurrent duplicate request may have committed while
                // we were waiting for this very lock.
                const committedWhileWaiting =
                    await findTransferBySenderAndIdempotencyKey(
                        senderWallet.id,
                        idempotencyKey,
                        tx,
                    );

                if (committedWhileWaiting) {
                    return toReplayResponse(committedWhileWaiting);
                }

                const { startUtc, endUtc } = getIstDayRangeUtc();

                const dailyTotalPaise = await getDailyCompletedTransferAmount(
                    senderWallet.id,
                    startUtc,
                    endUtc,
                    tx,
                );

                const dailyLimitPaise = inrToPaise(
                    env.TRANSFER_DAILY_LIMIT_INR,
                );

                if (dailyTotalPaise + amountPaise > dailyLimitPaise) {
                    throw new BusinessRuleError(
                        `Daily transfer limit of ₹${env.TRANSFER_DAILY_LIMIT_INR} exceeded`,
                    );
                }

                const recipientWallet = await findWalletByUserId(
                    recipient.userId,
                    tx,
                );

                if (!recipientWallet) {
                    throw new NotFoundError(
                        ERROR_MESSAGES.WALLET_NOT_FOUND,
                        ERROR_CODES.WALLET_NOT_FOUND,
                    );
                }

                const transaction = await createTransferTransaction(
                    {
                        referenceId,
                        userId: senderUserId,
                        sourceId: transferId,
                        description: `Transfer to ${recipient.name}`,
                    },
                    tx,
                );

                await debitWallet({
                    walletId: senderWallet.id,
                    amountPaise: totalPaise,
                    transactionId: transaction.id,
                    tx,
                });

                await creditWallet({
                    walletId: recipientWallet.id,
                    amountPaise,
                    transactionId: transaction.id,
                    tx,
                });

                if (feePaise > 0n) {
                    await creditWallet({
                        walletId: systemWallet.id,
                        amountPaise: feePaise,
                        transactionId: transaction.id,
                        tx,
                    });
                }

                const transfer = await createTransferRecord(
                    {
                        id: transferId,
                        transactionId: transaction.id,
                        senderWalletId: senderWallet.id,
                        receiverWalletId: recipientWallet.id,
                        amountPaise,
                        feePaise,
                        totalPaise,
                        idempotencyKey,
                    },
                    tx,
                );

                return {
                    id: transfer.id,
                    referenceId,
                    recipient,
                    amount: paiseToInr(amountPaise),
                    fee: paiseToInr(feePaise),
                    total: paiseToInr(totalPaise),
                    status: transfer.status,
                    createdAt: transfer.createdAt,
                };
            },
        );

        return result;
    } catch (error) {
        // Final safety net: two requests that both passed every check
        // above and raced to this exact insert. The loser's entire
        // transaction (debit/credits included) has already been rolled
        // back by Postgres — re-fetch and return the winner's transfer.
        if (isUniqueViolation(error)) {
            const existingAfterRace =
                await findTransferBySenderAndIdempotencyKey(
                    senderWallet.id,
                    idempotencyKey,
                );

            if (existingAfterRace) {
                return toReplayResponse(existingAfterRace);
            }
        }

        throw error;
    }
};
