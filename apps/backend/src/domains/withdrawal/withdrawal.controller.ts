import type { RequestHandler } from 'express';

import { SUCCESS_CODES } from '../../constants/response.constants.js';
import { sendSuccess } from '../../lib/http.js';

import { createWithdrawal } from './withdrawal.service.js';
import type { CreateWithdrawalInput } from './withdrawal.validator.js';

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
