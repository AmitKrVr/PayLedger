import {
    index,
    inet,
    jsonb,
    pgTable,
    timestamp,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';

import {
    auditActorTypeEnum,
    auditStatusEnum,
} from './enums/index.js';
import { admins, users } from './identity.schema.js';

export const auditLogs = pgTable(
    'audit_logs',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        actorType: auditActorTypeEnum('actor_type').notNull(),

        actorUserId: uuid('actor_user_id').references(() => users.id, {
            onDelete: 'set null',
        }),

        actorAdminId: uuid('actor_admin_id').references(() => admins.id, {
            onDelete: 'set null',
        }),

        action: varchar('action', { length: 100 }).notNull(),

        status: auditStatusEnum('status').notNull(),

        targetType: varchar('target_type', { length: 50 }).notNull(),

        targetId: varchar('target_id', { length: 100 }),

        metadata: jsonb('metadata'),

        requestId: varchar('request_id', { length: 64 }),

        ipAddress: inet('ip_address'),

        userAgent: varchar('user_agent', { length: 500 }),

        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('audit_logs_actor_user_id_idx').on(table.actorUserId),
        index('audit_logs_actor_admin_id_idx').on(table.actorAdminId),
        index('audit_logs_action_idx').on(table.action),
        index('audit_logs_target_idx').on(table.targetType, table.targetId),
        index('audit_logs_created_at_idx').on(table.createdAt),
    ],
);