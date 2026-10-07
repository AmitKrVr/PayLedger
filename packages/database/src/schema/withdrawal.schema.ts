import {
    bigint,
    check,
    index,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';

import { withdrawalStatusEnum } from './enums/index.js';
import { admins } from './identity.schema.js';
import { transactions } from './transaction.schema.js';
import { wallets } from './wallet.schema.js';
import { sql } from 'drizzle-orm';

export const withdrawals = pgTable(
    'withdrawals',
    {
        id: uuid('id').primaryKey(),

        transactionId: uuid('transaction_id').references(
            () => transactions.id,
            {
                onDelete: 'restrict',
            },
        ),

        walletId: uuid('wallet_id')
            .notNull()
            .references(() => wallets.id, {
                onDelete: 'restrict',
            }),

        amountPaise: bigint('amount_paise', {
            mode: 'bigint',
        }).notNull(),

        status: withdrawalStatusEnum('status')
            .notNull()
            .default('PENDING'),

        idempotencyKey: uuid('idempotency_key').notNull(),

        rejectionReason: varchar('rejection_reason', {
            length: 500,
        }),

        requestedAt: timestamp('requested_at', {
            withTimezone: true,
        })
            .notNull()
            .defaultNow(),

        processedAt: timestamp('processed_at', {
            withTimezone: true,
        }),

        processedByAdminId: uuid('processed_by_admin_id').references(
            () => admins.id,
            {
                onDelete: 'restrict',
            },
        ),

        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),

        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('withdrawals_wallet_id_idx').on(table.walletId),
        index('withdrawals_status_idx').on(table.status),
        index('withdrawals_requested_at_idx').on(table.requestedAt),
        index('withdrawals_processed_by_admin_idx').on(
            table.processedByAdminId,
        ),

        uniqueIndex('withdrawals_wallet_idempotency_unique_idx').on(
            table.walletId,
            table.idempotencyKey,
        ),

        check(
            'withdrawals_amount_positive_check',
            sql`${table.amountPaise} > 0`,
        ),
    ],
);