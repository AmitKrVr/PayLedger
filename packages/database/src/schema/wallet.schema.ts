import {
    bigint,
    char,
    check,
    index,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import {
    walletStatusEnum,
    walletTypeEnum,
} from './enums/index.js';
import { users } from './identity.schema.js';

export const wallets = pgTable(
    'wallets',
    {
        id: uuid('id').primaryKey(),

        userId: uuid('user_id').references(() => users.id, {
            onDelete: 'restrict',
        }),

        walletType: walletTypeEnum('wallet_type')
            .notNull()
            .default('USER'),

        balancePaise: bigint('balance_paise', { mode: 'bigint' })
            .notNull()
            .default(sql`0`),


        heldPaise: bigint('held_paise', { mode: 'bigint' })
            .notNull()
            .default(sql`0`),


        totalCreditedPaise: bigint('total_credited_paise', { mode: 'bigint' })
            .notNull()
            .default(sql`0`),


        totalDebitedPaise: bigint('total_debited_paise', { mode: 'bigint' })
            .notNull()
            .default(sql`0`),


        currency: char('currency', { length: 3 })
            .notNull()
            .default('INR'),

        status: walletStatusEnum('status')
            .notNull()
            .default('ACTIVE'),

        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),

        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('wallets_user_id_idx').on(table.userId),
        index('wallets_type_idx').on(table.walletType),
        index('wallets_status_idx').on(table.status),

        uniqueIndex('wallets_user_unique_idx')
            .on(table.userId)
            .where(sql`${table.walletType} = 'USER'`),

        check(
            'wallets_user_system_type_check',
            sql`
                (
                    ${table.walletType} = 'USER'
                    AND ${table.userId} IS NOT NULL
                )
                OR
                (
                    ${table.walletType} = 'SYSTEM'
                    AND ${table.userId} IS NULL
                )
            `,
        ),

        check(
            'wallets_balance_non_negative_check',
            sql`${table.balancePaise} >= 0`,
        ),

        check(
            'wallets_held_non_negative_check',
            sql`${table.heldPaise} >= 0`,
        ),

        check(
            'wallets_held_not_greater_than_balance_check',
            sql`${table.heldPaise} <= ${table.balancePaise}`,
        ),

        check(
            'wallets_total_credited_non_negative_check',
            sql`${table.totalCreditedPaise} >= 0`,
        ),

        check(
            'wallets_total_debited_non_negative_check',
            sql`${table.totalDebitedPaise} >= 0`,
        ),
    ],
);