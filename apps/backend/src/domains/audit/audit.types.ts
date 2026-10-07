import type { Request } from 'express';

import type {
    AuditActorType,
    AuditStatus,
    DatabaseOrTransaction,
} from '@payledger/database';

export type AuditCategory =
    | 'AUTH'
    | 'PAYMENT'
    | 'TRANSFER'
    | 'WITHDRAWAL'
    | 'WALLET'
    | 'ADMIN';

export type CreateAuditLogInput = {
    category: AuditCategory;
    action: string;
    status?: AuditStatus;

    actorType: AuditActorType;
    actorUserId?: string | null;
    actorAdminId?: string | null;

    targetType: string;
    targetId?: string | null;

    metadata?: Record<string, unknown> | null;

    requestId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
};

export type LogFromRequestOptions = Omit<
    CreateAuditLogInput,
    | 'actorType'
    | 'actorUserId'
    | 'actorAdminId'
    | 'requestId'
    | 'ipAddress'
    | 'userAgent'
> & {
    req: Request;
    actorType?: AuditActorType;
    actorUserId?: string | null;
    actorAdminId?: string | null;
};

export type AuditExecutor = DatabaseOrTransaction;