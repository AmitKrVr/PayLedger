import {
    index,
    jsonb,
    pgTable,
    timestamp,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';

import {
    transactionSourceTypeEnum,
    transactionStatusEnum,
    transactionTypeEnum,
} from './enums/index.js';
import { users } from './identity.schema.js';

export const transactions = pgTable(
    'transactions',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        referenceId: varchar('reference_id', { length: 32 })
            .notNull()
            .unique(),

        type: transactionTypeEnum('type').notNull(),

        status: transactionStatusEnum('status').notNull(),

        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),

        sourceType: transactionSourceTypeEnum('source_type').notNull(),

        sourceId: uuid('source_id').notNull(),

        description: varchar('description', { length: 500 }),

        metadata: jsonb('metadata'),

        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),

        completedAt: timestamp('completed_at', { withTimezone: true }),
    },
    (table) => [
        index('transactions_user_id_idx').on(table.userId),
        index('transactions_type_idx').on(table.type),
        index('transactions_status_idx').on(table.status),
        index('transactions_created_at_idx').on(table.createdAt),
        index('transactions_source_idx').on(
            table.sourceType,
            table.sourceId,
        ),
    ],
);