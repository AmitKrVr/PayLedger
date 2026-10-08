import type { RequestHandler } from 'express';

import { sendPaginated, sendSuccess } from '../../../lib/http.js';

import { getTransaction, listTransactions } from './admin-transaction.service.js';
import type {
    ListTransactionsQuery,
    TransactionIdParams,
} from './admin-transaction.validator.js';

export const listTransactionsController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const query = req.validatedQuery as ListTransactionsQuery;

        const { items, totalItems } = await listTransactions(query);

        return sendPaginated(res, {
            data: items,
            page: query.page,
            limit: query.limit,
            totalItems,
        });
    } catch (error) {
        next(error);
    }
};

export const getTransactionController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { id } = req.validatedParams as TransactionIdParams;

        const transaction = await getTransaction(id);

        return sendSuccess(res, {
            data: transaction,
        });
    } catch (error) {
        next(error);
    }
};
