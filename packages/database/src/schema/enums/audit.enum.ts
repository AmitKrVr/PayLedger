import { pgEnum } from 'drizzle-orm/pg-core';

export const auditActorTypeEnum = pgEnum('audit_actor_type', [
    'USER',
    'ADMIN',
    'SYSTEM',
]);

export type AuditActorType = (typeof auditActorTypeEnum.enumValues)[number];

export const AuditActorType: { [K in AuditActorType]: K } = {
    USER: 'USER',
    ADMIN: 'ADMIN',
    SYSTEM: 'SYSTEM',
};

export const auditStatusEnum = pgEnum('audit_status', [
    'SUCCESS',
    'FAILURE',
]);

export type AuditStatus = (typeof auditStatusEnum.enumValues)[number];

export const AuditStatus: { [K in AuditStatus]: K } = {
    SUCCESS: 'SUCCESS',
    FAILURE: 'FAILURE',
};