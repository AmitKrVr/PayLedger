import { db, WithdrawalStatus } from '@payledger/database';
import { generateBusinessId } from '@payledger/shared';

import { ERROR_CODES } from '../../../constants/response.constants.js';
import { ERROR_MESSAGES } from '../../../constants/message.constants.js';
import { paiseToInr } from '../../../lib/money.js';
import {
    ConflictError,
    NotFoundError,
} from '../../../middleware/error.middleware.js';

import { auditService } from '../../audit/audit.service.js';
import {
    debitWallet,
    releaseWalletHold,
} from '../../wallet/wallet.operations.js';
import { findWalletByIdForUpdate } from '../../wallet/wallet.repository.js';

import {
    countWithdrawals,
    createWithdrawalTransaction,
    findWithdrawalByIdWithUser,
    findWithdrawalForUpdate,
    findWithdrawals,
    updateWithdrawalApproved,
    updateWithdrawalRejected,
} from './admin-withdrawal.repository.js';
import type { RejectWithdrawalInput } from './admin-withdrawal.validator.js';

type AuditContext = {
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
};

type WithdrawalUserRow = {
    id: string;
    amountPaise: bigint;
    status: WithdrawalStatus;
    requestedAt: Date;
    processedAt: Date | null;
    userId: string;
    userName: string;
    userMobile: string;
};

type WithdrawalListItem = {
    id: string;
    user: { id: string; name: string; mobile: string };
    amount: number;
    status: WithdrawalStatus;
    requestedAt: Date;
    processedAt: Date | null;
};

type WithdrawalDetail = WithdrawalListItem & {
    rejectionReason: string | null;
    processedByAdminId: string | null;
};

const toListItem = (row: WithdrawalUserRow): WithdrawalListItem => ({
    id: row.id,
    user: {
        id: row.userId,
        name: row.userName,
        mobile: row.userMobile,
    },
    amount: paiseToInr(row.amountPaise),
    status: row.status,
    requestedAt: row.requestedAt,
    processedAt: row.processedAt,
});

export const listWithdrawals = async (filters: {
    status?: WithdrawalStatus;
    page: number;
    limit: number;
}): Promise<{ items: WithdrawalListItem[]; totalItems: number }> => {
    const [rows, totalItems] = await Promise.all([
        findWithdrawals(filters),
        countWithdrawals({ status: filters.status }),
    ]);

    return {
        items: rows.map(toListItem),
        totalItems,
    };
};

export const getWithdrawal = async (
    id: string,
): Promise<WithdrawalDetail> => {
    const row = await findWithdrawalByIdWithUser(id);

    if (!row) {
        throw new NotFoundError('Withdrawal not found', ERROR_CODES.NOT_FOUND);
    }

    return {
        ...toListItem(row),
        rejectionReason: row.rejectionReason,
        processedByAdminId: row.processedByAdminId,
    };
};

export const approveWithdrawal = async (
    withdrawalId: string,
    adminId: string,
    context: AuditContext = {},
) => {
    return db.transaction(async (tx) => {
        const withdrawal = await findWithdrawalForUpdate(withdrawalId, tx);

        if (!withdrawal) {
            throw new NotFoundError(
                'Withdrawal not found',
                ERROR_CODES.NOT_FOUND,
            );
        }

        if (withdrawal.status !== WithdrawalStatus.PENDING) {
            throw new ConflictError(
                'This withdrawal has already been processed',
            );
        }

        const wallet = await findWalletByIdForUpdate(
            withdrawal.walletId,
            tx,
        );

        if (!wallet || !wallet.userId) {
            throw new NotFoundError(
                ERROR_MESSAGES.WALLET_NOT_FOUND,
                ERROR_CODES.WALLET_NOT_FOUND,
            );
        }

        const referenceId = generateBusinessId();

        const transaction = await createWithdrawalTransaction(
            {
                referenceId,
                userId: wallet.userId,
                sourceId: withdrawal.id,
                description: 'Withdrawal approved',
            },
            tx,
        );

        // Release the hold BEFORE debiting. debitWallet() only allows
        // spending from *available* balance (balance - held); the
        // withdrawal amount is already reserved in `held`, so releasing
        // it first frees that exact amount back into "available" first.
        // The common case — a user holding their entire balance for a
        // single withdrawal — would otherwise read available=0 and
        // debitWallet would wrongly reject a perfectly valid approval.
        // Net effect on the wallet row is identical either way; only
        // this order is correct in every case.
        await releaseWalletHold({
            walletId: wallet.id,
            amountPaise: withdrawal.amountPaise,
            tx,
        });

        await debitWallet({
            walletId: wallet.id,
            amountPaise: withdrawal.amountPaise,
            transactionId: transaction.id,
            tx,
        });

        const updated = await updateWithdrawalApproved(
            withdrawal.id,
            {
                transactionId: transaction.id,
                processedByAdminId: adminId,
            },
            tx,
        );

        await auditService.log(
            {
                category: 'WITHDRAWAL',
                action: 'WITHDRAWAL_APPROVED',
                status: 'SUCCESS',
                actorType: 'ADMIN',
                actorAdminId: adminId,
                targetType: 'WITHDRAWAL',
                targetId: withdrawal.id,
                requestId: context.requestId ?? null,
                ipAddress: context.ipAddress ?? null,
                userAgent: context.userAgent ?? null,
            },
            tx,
        );

        return {
            id: updated.id,
            status: updated.status,
            transactionId: updated.transactionId,
            processedAt: updated.processedAt,
        };
    });
};

export const rejectWithdrawal = async (
    withdrawalId: string,
    adminId: string,
    input: RejectWithdrawalInput,
    context: AuditContext = {},
) => {
    return db.transaction(async (tx) => {
        const withdrawal = await findWithdrawalForUpdate(withdrawalId, tx);

        if (!withdrawal) {
            throw new NotFoundError(
                'Withdrawal not found',
                ERROR_CODES.NOT_FOUND,
            );
        }

        if (withdrawal.status !== WithdrawalStatus.PENDING) {
            throw new ConflictError(
                'This withdrawal has already been processed',
            );
        }

        const wallet = await findWalletByIdForUpdate(
            withdrawal.walletId,
            tx,
        );

        if (!wallet) {
            throw new NotFoundError(
                ERROR_MESSAGES.WALLET_NOT_FOUND,
                ERROR_CODES.WALLET_NOT_FOUND,
            );
        }

        await releaseWalletHold({
            walletId: wallet.id,
            amountPaise: withdrawal.amountPaise,
            tx,
        });

        const updated = await updateWithdrawalRejected(
            withdrawal.id,
            {
                rejectionReason: input.reason,
                processedByAdminId: adminId,
            },
            tx,
        );

        await auditService.log(
            {
                category: 'WITHDRAWAL',
                action: 'WITHDRAWAL_REJECTED',
                status: 'SUCCESS',
                actorType: 'ADMIN',
                actorAdminId: adminId,
                targetType: 'WITHDRAWAL',
                targetId: withdrawal.id,
                metadata: { reason: input.reason },
                requestId: context.requestId ?? null,
                ipAddress: context.ipAddress ?? null,
                userAgent: context.userAgent ?? null,
            },
            tx,
        );

        return {
            id: updated.id,
            status: updated.status,
            rejectionReason: updated.rejectionReason,
            processedAt: updated.processedAt,
        };
    });
};
