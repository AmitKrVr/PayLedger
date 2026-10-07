import {
    bigint,
    check,
    index,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { transferStatusEnum } from './enums/index.js';
import { transactions } from './transaction.schema.js';
import { wallets } from './wallet.schema.js';

export const transfers = pgTable(
    'transfers',
    {
        id: uuid('id').primaryKey(),

        transactionId: uuid('transaction_id')
            .notNull()
            .references(() => transactions.id, {
                onDelete: 'restrict',
            })
            .unique(),

        senderWalletId: uuid('sender_wallet_id')
            .notNull()
            .references(() => wallets.id, {
                onDelete: 'restrict',
            }),

        receiverWalletId: uuid('receiver_wallet_id')
            .notNull()
            .references(() => wallets.id, {
                onDelete: 'restrict',
            }),

        amountPaise: bigint('amount_paise', {
            mode: 'bigint',
        }).notNull(),

        feePaise: bigint('fee_paise', {
            mode: 'bigint',
        }).notNull(),

        totalPaise: bigint('total_paise', {
            mode: 'bigint',
        }).notNull(),

        idempotencyKey: uuid('idempotency_key').notNull(),

        status: transferStatusEnum('status')
            .notNull()
            .default('PENDING'),

        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),

        completedAt: timestamp('completed_at', { withTimezone: true }),
    },
    (table) => [
        index('transfers_sender_wallet_id_idx').on(table.senderWalletId),
        index('transfers_receiver_wallet_id_idx').on(table.receiverWalletId),
        index('transfers_status_idx').on(table.status),
        index('transfers_created_at_idx').on(table.createdAt),

        uniqueIndex('transfers_sender_idempotency_unique_idx').on(
            table.senderWalletId,
            table.idempotencyKey,
        ),

        check(
            'transfers_amount_positive_check',
            sql`${table.amountPaise} > 0`,
        ),

        check(
            'transfers_fee_non_negative_check',
            sql`${table.feePaise} >= 0`,
        ),

        check(
            'transfers_total_positive_check',
            sql`${table.totalPaise} > 0`,
        ),

        check(
            'transfers_total_matches_amount_fee_check',
            sql`${table.totalPaise} = ${table.amountPaise} + ${table.feePaise}`,
        ),

        check(
            'transfers_sender_receiver_different_check',
            sql`${table.senderWalletId} <> ${table.receiverWalletId}`,
        ),
    ],
);