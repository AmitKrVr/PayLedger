import type { RequestHandler } from 'express';

import { SUCCESS_CODES } from '../../constants/response.constants.js';
import { sendSuccess } from '../../lib/http.js';

import { createTransfer, lookupRecipient } from './transfer.service.js';
import type {
    CreateTransferInput,
    RecipientLookupInput,
} from './transfer.validator.js';

export const lookupRecipientController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { mobile } = req.body as RecipientLookupInput;

        const recipient = await lookupRecipient(req.user!.userId, mobile);

        return sendSuccess(res, {
            data: recipient,
        });
    } catch (error) {
        next(error);
    }
};

export const createTransferController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const body = req.body as CreateTransferInput;
        const idempotencyKey = req.get('idempotency-key');

        const transfer = await createTransfer(
            req.user!.userId,
            body,
            idempotencyKey,
        );

        return sendSuccess(res, {
            statusCode: 201,
            code: SUCCESS_CODES.CREATED,
            data: transfer,
        });
    } catch (error) {
        next(error);
    }
};
