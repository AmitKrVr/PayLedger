import {
    auditLogs,
    db,
    type DatabaseOrTransaction,
} from '@payledger/database';

import type { CreateAuditLogInput } from './audit.types.js';
export const insertAuditLog = async (
    input: CreateAuditLogInput,
    executor: DatabaseOrTransaction = db,
) => {
    const [auditLog] = await executor
        .insert(auditLogs)
        .values({
            actorType: input.actorType,
            actorUserId: input.actorUserId ?? null,
            actorAdminId: input.actorAdminId ?? null,
            action: input.action,
            status: input.status ?? 'SUCCESS',
            targetType: input.targetType,
            targetId: input.targetId ?? null,
            metadata: input.metadata ?? null,
            requestId: input.requestId ?? null,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
        })
        .returning();

    return auditLog;
};