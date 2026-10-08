import {
    countAuditLogs,
    findAuditLogs,
    type ListAuditLogsFilters,
} from './admin-audit-log.repository.js';
import type { ListAuditLogsQuery } from './admin-audit-log.validator.js';

export const listAuditLogs = async (query: ListAuditLogsQuery) => {
    const filters: ListAuditLogsFilters = {
        search: query.search,
        action: query.action,
        adminId: query.adminId,
        targetType: query.targetType,
        from: query.from,
        to: query.to,
        page: query.page,
        limit: query.limit,
    };

    const [rows, totalItems] = await Promise.all([
        findAuditLogs(filters),
        countAuditLogs(filters),
    ]);

    return {
        items: rows.map((row) => ({
            id: row.id,
            actor:
                row.actorType === 'ADMIN'
                    ? { type: row.actorType, name: row.adminName, detail: row.adminEmail }
                    : row.actorType === 'USER'
                      ? { type: row.actorType, name: row.userName, detail: row.userMobile }
                      : { type: row.actorType, name: 'System', detail: null },
            action: row.action,
            status: row.status,
            targetType: row.targetType,
            targetId: row.targetId,
            metadata: row.metadata,
            requestId: row.requestId,
            createdAt: row.createdAt,
        })),
        totalItems,
    };
};
