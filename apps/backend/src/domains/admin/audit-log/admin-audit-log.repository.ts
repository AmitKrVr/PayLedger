import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';

import {
    admins,
    auditLogs,
    db,
    users,
    type DatabaseOrTransaction,
} from '@payledger/database';

export type ListAuditLogsFilters = {
    search?: string;
    action?: string;
    adminId?: string;
    targetType?: string;
    from?: Date;
    to?: Date;
    page: number;
    limit: number;
};

const buildAuditLogConditions = (filters: ListAuditLogsFilters) => {
    const conditions = [];

    if (filters.search) {
        const term = `%${filters.search}%`;
        conditions.push(
            or(
                ilike(auditLogs.targetId, term),
                ilike(admins.name, term),
                ilike(admins.email, term),
                ilike(users.name, term),
                ilike(users.mobile, term),
            ),
        );
    }

    if (filters.action) {
        conditions.push(eq(auditLogs.action, filters.action));
    }

    if (filters.adminId) {
        conditions.push(eq(auditLogs.actorAdminId, filters.adminId));
    }

    if (filters.targetType) {
        conditions.push(eq(auditLogs.targetType, filters.targetType));
    }

    if (filters.from) {
        conditions.push(gte(auditLogs.createdAt, filters.from));
    }

    if (filters.to) {
        conditions.push(lte(auditLogs.createdAt, filters.to));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
};

const buildBaseQuery = (executor: DatabaseOrTransaction) =>
    executor
        .select({
            id: auditLogs.id,
            actorType: auditLogs.actorType,
            adminName: admins.name,
            adminEmail: admins.email,
            userName: users.name,
            userMobile: users.mobile,
            action: auditLogs.action,
            status: auditLogs.status,
            targetType: auditLogs.targetType,
            targetId: auditLogs.targetId,
            metadata: auditLogs.metadata,
            requestId: auditLogs.requestId,
            createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(admins, eq(auditLogs.actorAdminId, admins.id))
        .leftJoin(users, eq(auditLogs.actorUserId, users.id));

export const findAuditLogs = async (
    filters: ListAuditLogsFilters,
    executor: DatabaseOrTransaction = db,
) =>
    buildBaseQuery(executor)
        .where(buildAuditLogConditions(filters))
        .orderBy(desc(auditLogs.createdAt))
        .limit(filters.limit)
        .offset((filters.page - 1) * filters.limit);

export const countAuditLogs = async (
    filters: ListAuditLogsFilters,
    executor: DatabaseOrTransaction = db,
): Promise<number> => {
    const [row] = await executor
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .leftJoin(admins, eq(auditLogs.actorAdminId, admins.id))
        .leftJoin(users, eq(auditLogs.actorUserId, users.id))
        .where(buildAuditLogConditions(filters));

    return row?.count ?? 0;
};
