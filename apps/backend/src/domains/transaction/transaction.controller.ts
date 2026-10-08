import type { RequestHandler } from 'express';

import { sendPaginated, sendSuccess } from '../../lib/http.js';

import { getTransactionById, getTransactions } from './transaction.service.js';
import type {
    ListTransactionsQuery,
    TransactionIdParams,
} from './transaction.validators.js';

export const listTransactionsController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { page, limit, type, status, from, to } =
            req.validatedQuery as ListTransactionsQuery;

        const { items, totalItems } = await getTransactions(
            req.user!.userId,
            { page, limit, type, status, from, to },
        );

        return sendPaginated(res, {
            data: items,
            page,
            limit,
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

        const transaction = await getTransactionById(req.user!.userId, id);

        return sendSuccess(res, {
            data: transaction,
        });
    } catch (error) {
        next(error);
    }
};
