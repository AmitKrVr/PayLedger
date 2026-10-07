import {
    bigint,
    char,
    check,
    index,
    jsonb,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';

import { paymentStatusEnum } from './enums/index.js';
import { users } from './identity.schema.js';
import { sql } from 'drizzle-orm';

export const payments = pgTable(
    'payments',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),

        orderId: varchar('order_id', { length: 100 })
            .notNull()
            .unique(),

        paymentId: varchar('payment_id', { length: 100 }).unique(),

        provider: varchar('provider', { length: 50 }).notNull(),

        amountPaise: bigint('amount_paise', { mode: 'bigint' }).notNull(),

        currency: char('currency', { length: 3 })
            .notNull()
            .default('INR'),

        status: paymentStatusEnum('status')
            .notNull()
            .default('CREATED'),

        idempotencyKey: uuid('idempotency_key').notNull(),

        failureReason: varchar('failure_reason', { length: 500 }),

        metadata: jsonb('metadata'),

        paidAt: timestamp('paid_at', { withTimezone: true }),

        expiresAt: timestamp('expires_at', { withTimezone: true }),

        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),

        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('payments_user_id_idx').on(table.userId),
        index('payments_status_idx').on(table.status),
        index('payments_created_at_idx').on(table.createdAt),

        uniqueIndex('payments_user_idempotency_unique_idx').on(
            table.userId,
            table.idempotencyKey,
        ),

        check(
            'payments_amount_positive_check',
            sql`${table.amountPaise} > 0`,
        ),
    ],
);