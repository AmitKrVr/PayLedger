import { eq } from 'drizzle-orm';

import {
    transactions,
    transfers,
    TransactionSourceType,
    TransactionStatus,
    TransactionType,
    TransferStatus,
    type DatabaseOrTransaction,
} from '@payledger/database';

export const findTransferForUpdate = async (
    id: string,
    executor: DatabaseOrTransaction,
) => {
    const [transfer] = await executor
        .select()
        .from(transfers)
        .where(eq(transfers.id, id))
        .for('update')
        .limit(1);

    return transfer ?? null;
};

/**
 * Records the completed TRANSFER_REVERSAL financial transaction. Created
 * already COMPLETED — the reversal either finishes atomically with both
 * wallet movements inside one DB transaction, or the whole thing rolls
 * back, so there is no intermediate PENDING state here.
 */
export const createReversalTransaction = async (
    data: {
        referenceId: string;
        userId: string;
        sourceId: string;
        description: string;
    },
    executor: DatabaseOrTransaction,
) => {
    const [transaction] = await executor
        .insert(transactions)
        .values({
            referenceId: data.referenceId,
            type: TransactionType.TRANSFER_REVERSAL,
            status: TransactionStatus.COMPLETED,
            userId: data.userId,
            sourceType: TransactionSourceType.REVERSAL,
            sourceId: data.sourceId,
            description: data.description,
            completedAt: new Date(),
        })
        .returning();

    if (!transaction) {
        throw new Error('Failed to create reversal transaction');
    }

    return transaction;
};

/** `status` is the only column on `transfers` a reversal is allowed to change. */
export const updateTransferAsReversed = async (
    id: string,
    executor: DatabaseOrTransaction,
) => {
    const [transfer] = await executor
        .update(transfers)
        .set({ status: TransferStatus.REVERSED })
        .where(eq(transfers.id, id))
        .returning();

    if (!transfer) {
        throw new Error('Failed to update transfer as reversed');
    }

    return transfer;
};
