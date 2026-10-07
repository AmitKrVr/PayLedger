import { relations } from 'drizzle-orm';

import {
    adminSessions,
    admins,
    users,
    userSessions,
} from './identity.schema.js';
import { auditLogs } from './audit.schema.js';
import { wallets } from './wallet.schema.js';
import { payments } from './payment.schema.js';
import { transactions } from './transaction.schema.js';
import { ledgerEntries } from './ledger.schema.js';
import { transfers } from './transfer.schema.js';
import { withdrawals } from './withdrawal.schema.js';

export const usersRelations = relations(users, ({ many }) => ({
    sessions: many(userSessions),
    wallets: many(wallets),
    payments: many(payments),
    transactions: many(transactions),
    auditLogs: many(auditLogs),
}));

export const userSessionsRelations = relations(
    userSessions,
    ({ one }) => ({
        user: one(users, {
            fields: [userSessions.userId],
            references: [users.id],
        }),
    }),
);

export const adminsRelations = relations(admins, ({ many }) => ({
    sessions: many(adminSessions),
    processedWithdrawals: many(withdrawals),
    auditLogs: many(auditLogs),
}));

export const adminSessionsRelations = relations(
    adminSessions,
    ({ one }) => ({
        admin: one(admins, {
            fields: [adminSessions.adminId],
            references: [admins.id],
        }),
    }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
    actorUser: one(users, {
        fields: [auditLogs.actorUserId],
        references: [users.id],
        relationName: 'userAuditLogs',
    }),

    actorAdmin: one(admins, {
        fields: [auditLogs.actorAdminId],
        references: [admins.id],
        relationName: 'adminAuditLogs',
    }),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
    user: one(users, {
        fields: [wallets.userId],
        references: [users.id],
    }),

    ledgerEntries: many(ledgerEntries),

    sentTransfers: many(transfers, {
        relationName: 'senderWallet',
    }),

    receivedTransfers: many(transfers, {
        relationName: 'receiverWallet',
    }),

    withdrawals: many(withdrawals),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
    user: one(users, {
        fields: [payments.userId],
        references: [users.id],
    }),
}));

export const transactionsRelations = relations(
    transactions,
    ({ one, many }) => ({
        user: one(users, {
            fields: [transactions.userId],
            references: [users.id],
        }),

        ledgerEntries: many(ledgerEntries),

        transfer: one(transfers, {
            fields: [transactions.id],
            references: [transfers.transactionId],
        }),

        withdrawal: one(withdrawals, {
            fields: [transactions.id],
            references: [withdrawals.transactionId],
        }),
    }),
);

export const ledgerEntriesRelations = relations(
    ledgerEntries,
    ({ one }) => ({
        transaction: one(transactions, {
            fields: [ledgerEntries.transactionId],
            references: [transactions.id],
        }),

        wallet: one(wallets, {
            fields: [ledgerEntries.walletId],
            references: [wallets.id],
        }),
    }),
);

export const transfersRelations = relations(
    transfers,
    ({ one }) => ({
        transaction: one(transactions, {
            fields: [transfers.transactionId],
            references: [transactions.id],
        }),

        senderWallet: one(wallets, {
            fields: [transfers.senderWalletId],
            references: [wallets.id],
            relationName: 'senderWallet',
        }),

        receiverWallet: one(wallets, {
            fields: [transfers.receiverWalletId],
            references: [wallets.id],
            relationName: 'receiverWallet',
        }),
    }),
);

export const withdrawalsRelations = relations(
    withdrawals,
    ({ one }) => ({
        transaction: one(transactions, {
            fields: [withdrawals.transactionId],
            references: [transactions.id],
        }),

        wallet: one(wallets, {
            fields: [withdrawals.walletId],
            references: [wallets.id],
        }),

        processedByAdmin: one(admins, {
            fields: [withdrawals.processedByAdminId],
            references: [admins.id],
        }),
    }),
);