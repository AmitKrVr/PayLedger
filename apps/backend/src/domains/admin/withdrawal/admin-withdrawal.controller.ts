import type { Request, RequestHandler } from 'express';

import { sendPaginated, sendSuccess } from '../../../lib/http.js';

import {
    approveWithdrawal,
    getWithdrawal,
    listWithdrawals,
    rejectWithdrawal,
} from './admin-withdrawal.service.js';
import type {
    ListWithdrawalsQuery,
    RejectWithdrawalInput,
    WithdrawalIdParams,
} from './admin-withdrawal.validator.js';

const extractAuditContext = (req: Request) => ({
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
});

export const listWithdrawalsController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { page, limit, search, status } =
            req.validatedQuery as ListWithdrawalsQuery;

        const { items, totalItems } = await listWithdrawals({
            page,
            limit,
            search,
            status,
        });

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

        const withdrawal = await getWithdrawal(id);

        return sendSuccess(res, {
            data: withdrawal,
        });
    } catch (error) {
        next(error);
    }
};

export const approveWithdrawalController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { id } = req.validatedParams as WithdrawalIdParams;
        const context = extractAuditContext(req);

        const result = await approveWithdrawal(
            id,
            req.admin!.adminId,
            context,
        );

        return sendSuccess(res, {
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const rejectWithdrawalController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { id } = req.validatedParams as WithdrawalIdParams;
        const body = req.body as RejectWithdrawalInput;
        const context = extractAuditContext(req);

        const result = await rejectWithdrawal(
            id,
            req.admin!.adminId,
            body,
            context,
        );

        return sendSuccess(res, {
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
