import {
    bigint,
    check,
    index,
    pgTable,
    timestamp,
    uuid,
} from 'drizzle-orm/pg-core';

import { ledgerDirectionEnum } from './enums/index.js';
import { transactions } from './transaction.schema.js';
import { wallets } from './wallet.schema.js';
import { sql } from 'drizzle-orm';

export const ledgerEntries = pgTable(
    'ledger_entries',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        transactionId: uuid('transaction_id')
            .notNull()
            .references(() => transactions.id, {
                onDelete: 'restrict',
            }),

        walletId: uuid('wallet_id')
            .notNull()
            .references(() => wallets.id, {
                onDelete: 'restrict',
            }),

        amountPaise: bigint('amount_paise', {
            mode: 'bigint',
        }).notNull(),

        direction: ledgerDirectionEnum('direction').notNull(),

        balanceBeforePaise: bigint('balance_before_paise', {
            mode: 'bigint',
        }).notNull(),

        balanceAfterPaise: bigint('balance_after_paise', {
            mode: 'bigint',
        }).notNull(),

        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('ledger_entries_transaction_id_idx').on(table.transactionId),
        index('ledger_entries_wallet_id_idx').on(table.walletId),
        index('ledger_entries_created_at_idx').on(table.createdAt),

        check(
            'ledger_entries_amount_positive_check',
            sql`${table.amountPaise} > 0`,
        ),

        check(
            'ledger_entries_balance_before_non_negative_check',
            sql`${table.balanceBeforePaise} >= 0`,
        ),

        check(
            'ledger_entries_balance_after_non_negative_check',
            sql`${table.balanceAfterPaise} >= 0`,
        ),
    ],
);