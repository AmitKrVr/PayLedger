import { db, TransferStatus } from '@payledger/database';
import { generateBusinessId } from '@payledger/shared';

import { ERROR_CODES } from '../../../constants/response.constants.js';
import { ERROR_MESSAGES } from '../../../constants/message.constants.js';
import { inrToPaise, paiseToInr } from '../../../lib/money.js';
import {
    ConflictError,
    NotFoundError,
} from '../../../middleware/error.middleware.js';

import { auditService } from '../../audit/audit.service.js';
import { creditWallet, debitWallet } from '../../wallet/wallet.operations.js';
import { findWalletByIdForUpdate } from '../../wallet/wallet.repository.js';

import {
    countTransfers,
    createReversalTransaction,
    findReversalTransactionForTransfer,
    findTransferByIdWithParties,
    findTransferForUpdate,
    findTransfers,
    updateTransferAsReversed,
    type ListTransfersFilters,
} from './admin-transfer.repository.js';
import type { ListTransfersQuery } from './admin-transfer.validator.js';

type AuditContext = {
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
};

const toTransferListItem = (row: {
    id: string;
    referenceId: string;
    amountPaise: bigint;
    feePaise: bigint;
    totalPaise: bigint;
    status: string;
    createdAt: Date;
    completedAt: Date | null;
    senderUserId: string;
    senderName: string;
    senderMobile: string;
    receiverUserId: string;
    receiverName: string;
    receiverMobile: string;
}) => ({
    id: row.id,
    reference: row.referenceId,
    sender: { id: row.senderUserId, name: row.senderName, mobile: row.senderMobile },
    recipient: { id: row.receiverUserId, name: row.receiverName, mobile: row.receiverMobile },
    amount: paiseToInr(row.amountPaise),
    fee: paiseToInr(row.feePaise),
    total: paiseToInr(row.totalPaise),
    status: row.status,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
});

export const listTransfers = async (query: ListTransfersQuery) => {
    const filters: ListTransfersFilters = {
        search: query.search,
        status: query.status,
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
        findTransfers(filters),
        countTransfers(filters),
    ]);

    return {
        items: rows.map(toTransferListItem),
        totalItems,
    };
};

export const getTransfer = async (id: string) => {
    const row = await findTransferByIdWithParties(id);

    if (!row) {
        throw new NotFoundError('Transfer not found', ERROR_CODES.NOT_FOUND);
    }

    const reversal =
        row.status === TransferStatus.REVERSED
            ? await findReversalTransactionForTransfer(id)
            : null;

    return {
        ...toTransferListItem(row),
        reversedAt: reversal?.completedAt ?? null,
        reversalReference: reversal?.referenceId ?? null,
    };
};

export const reverseTransfer = async (
    transferId: string,
    adminId: string,
    context: AuditContext = {},
) => {
    return db.transaction(async (tx) => {
        const transfer = await findTransferForUpdate(transferId, tx);

        if (!transfer) {
            throw new NotFoundError(
                'Transfer not found',
                ERROR_CODES.NOT_FOUND,
            );
        }

        if (transfer.status === TransferStatus.REVERSED) {
            throw new ConflictError(
                'This transfer has already been reversed',
            );
        }

        if (transfer.status !== TransferStatus.COMPLETED) {
            throw new ConflictError(
                'Only completed transfers can be reversed',
            );
        }

        // Lock both wallets in a fixed, ID-ascending order (never
        // role-based sender/receiver order) so that reversing a transfer
        // between two wallets can never deadlock against another
        // reversal/transfer touching the same pair in the opposite
        // direction.
        const senderFirst = transfer.senderWalletId < transfer.receiverWalletId;
        const firstWalletId = senderFirst
            ? transfer.senderWalletId
            : transfer.receiverWalletId;
        const secondWalletId = senderFirst
            ? transfer.receiverWalletId
            : transfer.senderWalletId;

        const firstWallet = await findWalletByIdForUpdate(firstWalletId, tx);
        const secondWallet = await findWalletByIdForUpdate(
            secondWalletId,
            tx,
        );

        const senderWallet =
            firstWallet?.id === transfer.senderWalletId
                ? firstWallet
                : secondWallet;
        const receiverWallet =
            firstWallet?.id === transfer.receiverWalletId
                ? firstWallet
                : secondWallet;

        if (!senderWallet || !receiverWallet || !senderWallet.userId) {
            throw new NotFoundError(
                ERROR_MESSAGES.WALLET_NOT_FOUND,
                ERROR_CODES.WALLET_NOT_FOUND,
            );
        }

        const referenceId = generateBusinessId();

        const reversalTransaction = await createReversalTransaction(
            {
                referenceId,
                userId: senderWallet.userId,
                sourceId: transfer.id,
                description: 'Transfer reversal',
            },
            tx,
        );

        // Receiver gives back exactly what they received; sender gets
        // exactly what they originally sent (never the fee — that stays
        // with the system wallet and is never touched here).
        await debitWallet({
            walletId: receiverWallet.id,
            amountPaise: transfer.amountPaise,
            transactionId: reversalTransaction.id,
            tx,
        });

        await creditWallet({
            walletId: senderWallet.id,
            amountPaise: transfer.amountPaise,
            transactionId: reversalTransaction.id,
            tx,
        });

        const updatedTransfer = await updateTransferAsReversed(
            transfer.id,
            tx,
        );

        await auditService.log(
            {
                category: 'TRANSFER',
                action: 'TRANSFER_REVERSED',
                status: 'SUCCESS',
                actorType: 'ADMIN',
                actorAdminId: adminId,
                targetType: 'TRANSFER',
                targetId: transfer.id,
                metadata: { reversalTransactionId: reversalTransaction.id },
                requestId: context.requestId ?? null,
                ipAddress: context.ipAddress ?? null,
                userAgent: context.userAgent ?? null,
            },
            tx,
        );

        return {
            transferId: updatedTransfer.id,
            reversalTransactionId: reversalTransaction.id,
            referenceId,
            status: updatedTransfer.status,
            processedAt: reversalTransaction.completedAt,
        };
    });
};
