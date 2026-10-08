import { randomUUID } from 'node:crypto';

import {
    closeConnection,
    db,
    admins,
    adminSessions,
    ledgerEntries,
    transactions,
    transfers,
    users,
    wallets,
    withdrawals,
    payments,
    AdminRole,
    AdminStatus,
} from '@payledger/database';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import app from '../../app.js';
import { hashPassword } from '../../lib/auth/auth.js';

import { loginAdmin } from '../admin/auth/admin-auth.service.js';
import { reverseTransfer } from '../admin/transfer/admin-transfer.service.js';
import { approveWithdrawal } from '../admin/withdrawal/admin-withdrawal.service.js';
import { register } from '../auth/auth.service.js';
import { createPayment, processPaymentWebhook } from '../payment/payment.service.js';
import { createTransfer } from '../transfer/transfer.service.js';
import { findWalletByUserId } from '../wallet/wallet.repository.js';
import { createWithdrawal } from '../withdrawal/withdrawal.service.js';

const ADMIN_PASSWORD = 'AdminPass123!';

const createdAdminIds: string[] = [];
const createdUserIds: string[] = [];
const createdWalletIds: string[] = [];

const createTestAdmin = async () => {
    const email = `admin.${randomUUID()}@example.com`;
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    const [admin] = await db
        .insert(admins)
        .values({
            name: 'Test Admin',
            mobile,
            email,
            passwordHash,
            role: AdminRole.ADMIN,
            status: AdminStatus.ACTIVE,
        })
        .returning();

    if (!admin) {
        throw new Error('Failed to create test admin');
    }

    createdAdminIds.push(admin.id);

    const result = await loginAdmin({ email, password: ADMIN_PASSWORD }, {});

    return { id: admin.id, cookie: `access_token=${result.accessToken}` };
};

const createTestUser = async (balancePaise: bigint = 0n) => {
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

    const result = await register(
        {
            name: `Txn History Test ${Math.random().toString(36).slice(2, 8)}`,
            mobile,
            password: 'Password123!',
        },
        {},
    );

    createdUserIds.push(result.user.id);

    const wallet = await findWalletByUserId(result.user.id);
    if (!wallet) {
        throw new Error('Test user was created without a wallet');
    }
    createdWalletIds.push(wallet.id);

    if (balancePaise > 0n) {
        await db
            .update(wallets)
            .set({ balancePaise })
            .where(eq(wallets.id, wallet.id));
    }

    return {
        userId: result.user.id,
        userName: result.user.name,
        walletId: wallet.id,
        cookie: `access_token=${result.accessToken}`,
    };
};

/** Creates a real COMPLETED DEPOSIT transaction via the Payment domain's
 * own service functions (create + webhook success), never faked. */
const createDeposit = async (userId: string, amountInr: number) => {
    const payment = await createPayment(userId, { amount: amountInr }, randomUUID());

    await processPaymentWebhook({
        orderId: payment.orderId,
        paymentId: randomUUID(),
        status: 'SUCCESS',
        amount: amountInr,
    });

    const [txn] = await db
        .select()
        .from(transactions)
        .where(
            and(eq(transactions.userId, userId), eq(transactions.type, 'DEPOSIT')),
        )
        .orderBy(desc(transactions.createdAt))
        .limit(1);

    if (!txn) {
        throw new Error('Deposit transaction was not created');
    }

    return txn;
};

const createCompletedTransfer = (
    senderUserId: string,
    receiverUserId: string,
    amountInr: number,
) =>
    createTransfer(
        senderUserId,
        { recipientUserId: receiverUserId, amount: amountInr },
        randomUUID(),
    );

const findTransferTransaction = async (transferId: string) => {
    const [txn] = await db
        .select()
        .from(transactions)
        .where(
            and(
                eq(transactions.sourceId, transferId),
                eq(transactions.type, 'TRANSFER'),
            ),
        )
        .limit(1);

    if (!txn) {
        throw new Error('Transfer transaction was not created');
    }

    return txn;
};

const listTransactionsReq = (cookie: string, query = '') =>
    request(app).get(`/api/v1/transactions${query}`).set('Cookie', cookie);

const getTransactionReq = (cookie: string, id: string) =>
    request(app).get(`/api/v1/transactions/${id}`).set('Cookie', cookie);

const countLedgerEntriesForWallets = async (
    walletIds: string[],
): Promise<number> => {
    const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(ledgerEntries)
        .where(inArray(ledgerEntries.walletId, walletIds));

    return row?.count ?? 0;
};

const countTransactionsForUsers = async (userIds: string[]): Promise<number> => {
    const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(inArray(transactions.userId, userIds));

    return row?.count ?? 0;
};

const getWalletSnapshots = async (walletIds: string[]) =>
    db.select().from(wallets).where(inArray(wallets.id, walletIds));

describe('Transaction History domain', () => {
    afterAll(async () => {
        if (createdUserIds.length > 0) {
            const testWallets = await db
                .select()
                .from(wallets)
                .where(inArray(wallets.userId, createdUserIds));
            const walletIds = testWallets.map((w) => w.id);

            const testTransactions = await db
                .select({ id: transactions.id })
                .from(transactions)
                .where(inArray(transactions.userId, createdUserIds));
            const transactionIds = testTransactions.map((t) => t.id);

            if (transactionIds.length > 0) {
                await db
                    .delete(ledgerEntries)
                    .where(inArray(ledgerEntries.transactionId, transactionIds));
            }

            if (walletIds.length > 0) {
                await db
                    .delete(transfers)
                    .where(inArray(transfers.senderWalletId, walletIds));
                await db
                    .delete(transfers)
                    .where(inArray(transfers.receiverWalletId, walletIds));
                await db
                    .delete(withdrawals)
                    .where(inArray(withdrawals.walletId, walletIds));
            }

            await db
                .delete(payments)
                .where(inArray(payments.userId, createdUserIds));
            await db
                .delete(transactions)
                .where(inArray(transactions.userId, createdUserIds));
            await db
                .delete(wallets)
                .where(inArray(wallets.userId, createdUserIds));
            await db.delete(users).where(inArray(users.id, createdUserIds));
        }

        if (createdAdminIds.length > 0) {
            await db
                .delete(adminSessions)
                .where(inArray(adminSessions.adminId, createdAdminIds));
            await db.delete(admins).where(inArray(admins.id, createdAdminIds));
        }

        await closeConnection();
    });

    describe('GET /api/v1/transactions', () => {
        it('authenticated user can list own transactions', async () => {
            const user = await createTestUser();
            const deposit = await createDeposit(user.userId, 100);

            const res = await listTransactionsReq(user.cookie, '?limit=100');

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            const match = res.body.data.find(
                (t: { id: string }) => t.id === deposit.id,
            );
            expect(match).toMatchObject({
                id: deposit.id,
                type: 'DEPOSIT',
                status: 'COMPLETED',
                amount: 100,
                direction: 'CREDIT',
            });
        });

        it('rejects an unauthenticated list request', async () => {
            const res = await request(app).get('/api/v1/transactions');
            expect(res.status).toBe(401);
        });

        it("does not show another user's transactions in the list", async () => {
            const userA = await createTestUser();
            const userB = await createTestUser();
            const depositB = await createDeposit(userB.userId, 250);

            const res = await listTransactionsReq(userA.cookie, '?limit=100');

            expect(res.status).toBe(200);
            expect(
                res.body.data.some((t: { id: string }) => t.id === depositB.id),
            ).toBe(false);
        });

        it('paginates results with correct page/limit metadata', async () => {
            const user = await createTestUser();
            for (let i = 0; i < 5; i++) {
                await createDeposit(user.userId, 100 + i);
            }

            const page1 = await listTransactionsReq(user.cookie, '?page=1&limit=2');
            expect(page1.status).toBe(200);
            expect(page1.body.data).toHaveLength(2);
            expect(page1.body.meta.page).toBe(1);
            expect(page1.body.meta.limit).toBe(2);
            expect(page1.body.meta.totalItems).toBeGreaterThanOrEqual(5);
            expect(page1.body.meta.totalPages).toBe(
                Math.ceil(page1.body.meta.totalItems / 2),
            );
            expect(page1.body.meta.hasNextPage).toBe(true);
            expect(page1.body.meta.hasPreviousPage).toBe(false);

            const page2 = await listTransactionsReq(user.cookie, '?page=2&limit=2');
            expect(page2.status).toBe(200);
            expect(page2.body.meta.hasPreviousPage).toBe(true);

            const page1Ids = page1.body.data.map((t: { id: string }) => t.id);
            const page2Ids = page2.body.data.map((t: { id: string }) => t.id);
            expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(
                false,
            );
        });

        it('orders transactions newest first', async () => {
            const user = await createTestUser();
            const first = await createDeposit(user.userId, 100);
            const second = await createDeposit(user.userId, 101);

            const res = await listTransactionsReq(user.cookie, '?limit=100');
            const ids = res.body.data.map((t: { id: string }) => t.id);

            expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
        });

        it('filters by type', async () => {
            const user = await createTestUser(100000n);
            const deposit = await createDeposit(user.userId, 100);
            await createWithdrawal(user.userId, { amount: 100 }, randomUUID()); // stays PENDING

            const res = await listTransactionsReq(
                user.cookie,
                '?type=DEPOSIT&limit=100',
            );

            expect(res.status).toBe(200);
            for (const item of res.body.data) {
                expect(item.type).toBe('DEPOSIT');
            }
            expect(
                res.body.data.some((t: { id: string }) => t.id === deposit.id),
            ).toBe(true);
        });

        it('filters by status', async () => {
            const user = await createTestUser();
            const deposit = await createDeposit(user.userId, 100);

            const completed = await listTransactionsReq(
                user.cookie,
                '?status=COMPLETED&limit=100',
            );
            expect(completed.status).toBe(200);
            for (const item of completed.body.data) {
                expect(item.status).toBe('COMPLETED');
            }
            expect(
                completed.body.data.some(
                    (t: { id: string }) => t.id === deposit.id,
                ),
            ).toBe(true);

            const failed = await listTransactionsReq(
                user.cookie,
                '?status=FAILED&limit=100',
            );
            expect(
                failed.body.data.some((t: { id: string }) => t.id === deposit.id),
            ).toBe(false);
        });

        it('filters by date range (from inclusive, to inclusive)', async () => {
            const user = await createTestUser();
            const oldDeposit = await createDeposit(user.userId, 100);
            const recentDeposit = await createDeposit(user.userId, 101);

            await db
                .update(transactions)
                .set({ createdAt: new Date('2020-01-01T00:00:00.000Z') })
                .where(eq(transactions.id, oldDeposit.id));

            const recentOnly = await listTransactionsReq(
                user.cookie,
                '?from=2024-01-01&limit=100',
            );
            expect(
                recentOnly.body.data.some(
                    (t: { id: string }) => t.id === recentDeposit.id,
                ),
            ).toBe(true);
            expect(
                recentOnly.body.data.some(
                    (t: { id: string }) => t.id === oldDeposit.id,
                ),
            ).toBe(false);

            const oldOnly = await listTransactionsReq(
                user.cookie,
                '?to=2020-06-01&limit=100',
            );
            expect(
                oldOnly.body.data.some(
                    (t: { id: string }) => t.id === oldDeposit.id,
                ),
            ).toBe(true);
            expect(
                oldOnly.body.data.some(
                    (t: { id: string }) => t.id === recentDeposit.id,
                ),
            ).toBe(false);
        });

        it('pending withdrawal does not appear as a financial transaction', async () => {
            const user = await createTestUser(100000n);
            await createWithdrawal(user.userId, { amount: 200 }, randomUUID());

            const res = await listTransactionsReq(
                user.cookie,
                '?type=WITHDRAWAL&limit=100',
            );

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });

    describe('GET /api/v1/transactions/:id', () => {
        it("detail endpoint returns the authenticated user's own transaction", async () => {
            const user = await createTestUser();
            const deposit = await createDeposit(user.userId, 300);

            const res = await getTransactionReq(user.cookie, deposit.id);

            expect(res.status).toBe(200);
            expect(res.body.data).toMatchObject({
                id: deposit.id,
                type: 'DEPOSIT',
                status: 'COMPLETED',
                amount: 300,
                direction: 'CREDIT',
            });
        });

        it("returns NOT_FOUND for another user's transaction", async () => {
            const userA = await createTestUser();
            const userB = await createTestUser();
            const depositB = await createDeposit(userB.userId, 150);

            const res = await getTransactionReq(userA.cookie, depositB.id);

            expect(res.status).toBe(404);
            expect(res.body.code).toBe('NOT_FOUND');
        });

        it('rejects an unauthenticated detail request', async () => {
            const res = await request(app).get(
                `/api/v1/transactions/${randomUUID()}`,
            );
            expect(res.status).toBe(401);
        });

        it("derives the deposit amount from the user's own ledger entry", async () => {
            const user = await createTestUser();
            const deposit = await createDeposit(user.userId, 777);

            const res = await getTransactionReq(user.cookie, deposit.id);

            expect(res.status).toBe(200);
            expect(res.body.data.amount).toBe(777);
            expect(res.body.data.direction).toBe('CREDIT');
        });

        it("outgoing transfer shows the sender's total debit (amount + fee)", async () => {
            const sender = await createTestUser(100000n); // ₹1,000
            const receiver = await createTestUser();
            const transfer = await createCompletedTransfer(
                sender.userId,
                receiver.userId,
                500,
            );
            const txn = await findTransferTransaction(transfer.id);

            const res = await getTransactionReq(sender.cookie, txn.id);

            expect(res.status).toBe(200);
            expect(res.body.data.type).toBe('TRANSFER');
            expect(res.body.data.direction).toBe('DEBIT');
            expect(res.body.data.amount).toBe(transfer.total); // amount + fee
            expect(res.body.data.counterparty).toMatchObject({
                userId: receiver.userId,
                name: receiver.userName,
            });
        });

        it('incoming transfer shows only the transfer amount (fee excluded)', async () => {
            const sender = await createTestUser(100000n);
            const receiver = await createTestUser();
            const transfer = await createCompletedTransfer(
                sender.userId,
                receiver.userId,
                500,
            );
            const txn = await findTransferTransaction(transfer.id);

            const res = await getTransactionReq(receiver.cookie, txn.id);

            expect(res.status).toBe(200);
            expect(res.body.data.direction).toBe('CREDIT');
            expect(res.body.data.amount).toBe(transfer.amount);
            expect(res.body.data.counterparty).toMatchObject({
                userId: sender.userId,
                name: sender.userName,
            });
        });

        it('transfer reversal shows the correct movement for both sides', async () => {
            const admin = await createTestAdmin();
            const sender = await createTestUser(100000n);
            const receiver = await createTestUser();
            const transfer = await createCompletedTransfer(
                sender.userId,
                receiver.userId,
                500,
            );

            const reversal = await reverseTransfer(transfer.id, admin.id, {});

            const senderRes = await getTransactionReq(
                sender.cookie,
                reversal.reversalTransactionId,
            );
            expect(senderRes.status).toBe(200);
            expect(senderRes.body.data.type).toBe('TRANSFER_REVERSAL');
            expect(senderRes.body.data.direction).toBe('CREDIT');
            expect(senderRes.body.data.amount).toBe(transfer.amount); // fee never refunded

            const receiverRes = await getTransactionReq(
                receiver.cookie,
                reversal.reversalTransactionId,
            );
            expect(receiverRes.status).toBe(200);
            expect(receiverRes.body.data.direction).toBe('DEBIT');
            expect(receiverRes.body.data.amount).toBe(transfer.amount);
        });

        it('approved withdrawal shows the correct debit', async () => {
            const admin = await createTestAdmin();
            const user = await createTestUser(100000n);

            const withdrawal = await createWithdrawal(
                user.userId,
                { amount: 300 },
                randomUUID(),
            );
            const approved = await approveWithdrawal(withdrawal.id, admin.id, {});

            const res = await getTransactionReq(
                user.cookie,
                approved.transactionId!,
            );

            expect(res.status).toBe(200);
            expect(res.body.data.type).toBe('WITHDRAWAL');
            expect(res.body.data.direction).toBe('DEBIT');
            expect(res.body.data.amount).toBe(300);
        });
    });

    describe('Read-only guarantee', () => {
        it('never mutates financial tables', async () => {
            const admin = await createTestAdmin();
            const sender = await createTestUser(100000n);
            const receiver = await createTestUser();

            const deposit = await createDeposit(sender.userId, 100);
            const transfer = await createCompletedTransfer(
                sender.userId,
                receiver.userId,
                200,
            );
            const withdrawal = await createWithdrawal(
                sender.userId,
                { amount: 100 },
                randomUUID(),
            );
            await approveWithdrawal(withdrawal.id, admin.id, {});

            const relevantWalletIds = [sender.walletId, receiver.walletId];
            const relevantUserIds = [sender.userId, receiver.userId];

            const walletsBefore = await getWalletSnapshots(relevantWalletIds);
            const ledgerCountBefore =
                await countLedgerEntriesForWallets(relevantWalletIds);
            const transactionCountBefore =
                await countTransactionsForUsers(relevantUserIds);

            await listTransactionsReq(sender.cookie, '?limit=100');
            await getTransactionReq(sender.cookie, deposit.id);
            await listTransactionsReq(receiver.cookie, '?limit=100');
            await getTransactionReq(
                receiver.cookie,
                (await findTransferTransaction(transfer.id)).id,
            );

            const walletsAfter = await getWalletSnapshots(relevantWalletIds);
            const ledgerCountAfter =
                await countLedgerEntriesForWallets(relevantWalletIds);
            const transactionCountAfter =
                await countTransactionsForUsers(relevantUserIds);

            expect(walletsAfter).toEqual(walletsBefore);
            expect(ledgerCountAfter).toBe(ledgerCountBefore);
            expect(transactionCountAfter).toBe(transactionCountBefore);
        });
    });
});
