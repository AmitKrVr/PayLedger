import type { Request, RequestHandler } from 'express';

import { sendPaginated, sendSuccess } from '../../../lib/http.js';

import { getTransfer, listTransfers, reverseTransfer } from './admin-transfer.service.js';
import type {
    ListTransfersQuery,
    TransferIdParams,
} from './admin-transfer.validator.js';

const extractAuditContext = (req: Request) => ({
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
});

export const listTransfersController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const query = req.validatedQuery as ListTransfersQuery;

        const { items, totalItems } = await listTransfers(query);

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

export const getTransferController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { id } = req.validatedParams as TransferIdParams;

        const transfer = await getTransfer(id);

        return sendSuccess(res, {
            data: transfer,
        });
    } catch (error) {
        next(error);
    }
};

export const reverseTransferController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { id } = req.validatedParams as TransferIdParams;
        const context = extractAuditContext(req);

        const result = await reverseTransfer(id, req.admin!.adminId, context);

        return sendSuccess(res, {
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
