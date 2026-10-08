import { TransactionSourceType } from '@payledger/database';

import { ERROR_CODES } from '../../constants/response.constants.js';
import { paiseToInr } from '../../lib/money.js';
import { NotFoundError } from '../../middleware/error.middleware.js';

import {
    countTransactionsForUser,
    findTransactionByIdForUser,
    findTransactionsForUser,
    findTransferCounterparties,
    type TransactionFilters,
} from './transaction.repository.js';
import type { Counterparty, TransactionDto } from './transaction.types.js';
import type { ListTransactionsQuery } from './transaction.validators.js';

type TransactionRow = NonNullable<
    Awaited<ReturnType<typeof findTransactionByIdForUser>>
>;
type TransferCounterpartyRow = Awaited<
    ReturnType<typeof findTransferCounterparties>
>[number];

/**
 * Batch-resolves sender/receiver identity for every TRANSFER /
 * TRANSFER_REVERSAL row in a page with a single query, keyed by transfer
 * id — never N+1 per row.
 */
const buildCounterpartyMap = async (
    rows: TransactionRow[],
): Promise<Map<string, TransferCounterpartyRow>> => {
    const transferIds = rows
        .filter(
            (row) =>
                row.sourceType === TransactionSourceType.TRANSFER ||
                row.sourceType === TransactionSourceType.REVERSAL,
        )
        .map((row) => row.sourceId);

    if (transferIds.length === 0) {
        return new Map();
    }

    const counterparties = await findTransferCounterparties([
        ...new Set(transferIds),
    ]);

    return new Map(counterparties.map((row) => [row.transferId, row]));
};

const resolveCounterparty = (
    row: TransactionRow,
    counterpartyMap: Map<string, TransferCounterpartyRow>,
): Counterparty | null => {
    if (
        row.sourceType !== TransactionSourceType.TRANSFER &&
        row.sourceType !== TransactionSourceType.REVERSAL
    ) {
        return null;
    }

    const transfer = counterpartyMap.get(row.sourceId);

    if (!transfer) {
        return null;
    }

    // The ledger entry's own wallet tells us which side of the transfer
    // the authenticated user was on — never re-derive this from metadata.
    return row.walletId === transfer.senderWalletId
        ? { userId: transfer.receiverUserId, name: transfer.receiverName }
        : { userId: transfer.senderUserId, name: transfer.senderName };
};

const toTransactionDto = (
    row: TransactionRow,
    counterpartyMap: Map<string, TransferCounterpartyRow>,
): TransactionDto => ({
    id: row.id,
    referenceId: row.referenceId,
    type: row.type,
    status: row.status,
    amount: paiseToInr(row.amountPaise),
    direction: row.direction,
    description: row.description,
    counterparty: resolveCounterparty(row, counterpartyMap),
    createdAt: row.createdAt,
    completedAt: row.completedAt,
});

export const getTransactions = async (
    userId: string,
    query: ListTransactionsQuery,
): Promise<{ items: TransactionDto[]; totalItems: number }> => {
    const filters: TransactionFilters = {
        type: query.type,
        status: query.status,
        from: query.from,
        to: query.to,
    };

    const [rows, totalItems] = await Promise.all([
        findTransactionsForUser(userId, filters, {
            page: query.page,
            limit: query.limit,
        }),
        countTransactionsForUser(userId, filters),
    ]);

    const counterpartyMap = await buildCounterpartyMap(rows);

    return {
        items: rows.map((row) => toTransactionDto(row, counterpartyMap)),
        totalItems,
    };
};

export const getTransactionById = async (
    userId: string,
    transactionId: string,
): Promise<TransactionDto> => {
    const row = await findTransactionByIdForUser(transactionId, userId);

    if (!row) {
        throw new NotFoundError(
            'Transaction not found',
            ERROR_CODES.NOT_FOUND,
        );
    }

    const counterpartyMap = await buildCounterpartyMap([row]);

    return toTransactionDto(row, counterpartyMap);
};
