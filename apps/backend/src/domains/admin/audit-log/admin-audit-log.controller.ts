import type { RequestHandler } from 'express';

import { sendPaginated } from '../../../lib/http.js';

import { listAuditLogs } from './admin-audit-log.service.js';
import type { ListAuditLogsQuery } from './admin-audit-log.validator.js';

export const listAuditLogsController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const query = req.validatedQuery as ListAuditLogsQuery;

        const { items, totalItems } = await listAuditLogs(query);

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
