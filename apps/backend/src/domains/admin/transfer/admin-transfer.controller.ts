import type { Request, RequestHandler } from 'express';

import { sendSuccess } from '../../../lib/http.js';

import { reverseTransfer } from './admin-transfer.service.js';
import type { TransferIdParams } from './admin-transfer.validator.js';

const extractAuditContext = (req: Request) => ({
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
});

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
