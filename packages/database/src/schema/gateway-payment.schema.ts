import {
    bigint, char, check, index, jsonb, pgTable, timestamp, uuid, varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { gatewayPaymentStatusEnum } from './enums/index.js';

/**
 * Owned entirely by the Fake Payment Gateway app — PayLedger backend
 * never reads or writes this table directly. Deliberately has no
 * userId/walletId/transactionId/balance columns: the gateway has no
 * knowledge of PayLedger's financial state, only of the orderId it was
 * given and the fake payment lifecycle around it.
 */
export const gatewayPayments = pgTable(
    'gateway_payments',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        orderId: varchar('order_id', { length: 100 }).notNull().unique(),
        paymentId: varchar('payment_id', { length: 100 }).notNull().unique(),
        amountPaise: bigint('amount_paise', { mode: 'bigint' }).notNull(),
        currency: char('currency', { length: 3 }).notNull().default('INR'),
        status: gatewayPaymentStatusEnum('status').notNull().default('CREATED'),
        failureReason: varchar('failure_reason', { length: 500 }),
        metadata: jsonb('metadata'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        paidAt: timestamp('paid_at', { withTimezone: true }),
    },
    (table) => [
        index('gateway_payments_status_idx').on(table.status),
        index('gateway_payments_created_at_idx').on(table.createdAt),

        check(
            'gateway_payments_amount_positive_check',
            sql`${table.amountPaise} > 0`,
        ),
    ],
);
