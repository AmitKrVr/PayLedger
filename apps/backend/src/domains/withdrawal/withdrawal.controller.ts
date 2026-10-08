import type { RequestHandler } from 'express';

import { SUCCESS_CODES } from '../../constants/response.constants.js';
import { sendPaginated, sendSuccess } from '../../lib/http.js';

import { createWithdrawal, getWithdrawal, listWithdrawals } from './withdrawal.service.js';
import type {
    CreateWithdrawalInput,
    ListWithdrawalsQuery,
    WithdrawalIdParams,
} from './withdrawal.validator.js';

export const createWithdrawalController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const body = req.body as CreateWithdrawalInput;
        const idempotencyKey = req.get('idempotency-key');

        const withdrawal = await createWithdrawal(
            req.user!.userId,
            body,
            idempotencyKey,
        );

        return sendSuccess(res, {
            statusCode: 201,
            code: SUCCESS_CODES.CREATED,
            data: withdrawal,
        });
    } catch (error) {
        next(error);
    }
};

export const listWithdrawalsController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { page, limit, status } =
            req.validatedQuery as ListWithdrawalsQuery;

        const { items, totalItems } = await listWithdrawals(
            req.user!.userId,
            { page, limit, status },
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

export const getWithdrawalController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { id } = req.validatedParams as WithdrawalIdParams;

        const withdrawal = await getWithdrawal(id, req.user!.userId);

        return sendSuccess(res, {
            data: withdrawal,
        });
    } catch (error) {
        next(error);
    }
};
