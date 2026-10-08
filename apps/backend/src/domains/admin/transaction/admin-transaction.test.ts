import { randomUUID } from 'node:crypto';

import {
    closeConnection,
    db,
    admins,
    adminSessions,
    ledgerEntries,
    payments,
    transactions,
    users,
    wallets,
    AdminRole,
    AdminStatus,
} from '@payledger/database';
import { inArray } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import app from '../../../app.js';
import { hashPassword } from '../../../lib/auth/auth.js';

import { loginAdmin } from '../auth/admin-auth.service.js';
import { register } from '../../auth/auth.service.js';
import { processPaymentWebhook } from '../../payment/payment.service.js';

const ADMIN_PASSWORD = 'AdminPass123!';

const createdAdminIds: string[] = [];
const createdUserIds: string[] = [];

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

    return { id: admin.id, cookie: `admin_access_token=${result.accessToken}` };
};

const createTestUser = async () => {
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

    const result = await register(
        {
            name: `Admin Txn Test ${Math.random().toString(36).slice(2, 8)}`,
            mobile,
            password: 'Password123!',
        },
        {},
    );

    createdUserIds.push(result.user.id);

    return { userId: result.user.id, userCookie: `access_token=${result.accessToken}` };
};

/** Drives a real deposit all the way to a COMPLETED DEPOSIT transaction
 * via the actual webhook handler -- never fabricated. Inserts the
 * payment row directly (bypassing the gateway HTTP call, already covered
 * by payment.test.ts) so the webhook has a real CREATED payment to settle. */
const createCompletedDeposit = async (amountInr: number) => {
    const user = await createTestUser();
    const orderId = `ORD${randomUUID().slice(0, 8)}`;
    const gatewayPaymentId = randomUUID();

    const [createdPayment] = await db
        .insert(payments)
        .values({
            userId: user.userId,
            orderId,
            paymentId: gatewayPaymentId,
            provider: 'FAKE_GATEWAY',
            amountPaise: BigInt(amountInr * 100),
            status: 'CREATED',
            idempotencyKey: randomUUID(),
        })
        .returning();

    if (!createdPayment) {
        throw new Error('Failed to create test payment');
    }

    await processPaymentWebhook({
        orderId,
        paymentId: gatewayPaymentId,
        status: 'SUCCESS',
        amount: amountInr * 100,
    });

    const [transaction] = await db
        .select()
        .from(transactions)
        .where(inArray(transactions.userId, [user.userId]));

    return { user, transaction: transaction! };
};

const listTransactionsReq = (cookie: string, query = '') =>
    request(app).get(`/api/v1/admin/transactions${query}`).set('Cookie', cookie);

const getTransactionReq = (cookie: string, id: string) =>
    request(app).get(`/api/v1/admin/transactions/${id}`).set('Cookie', cookie);

describe('Admin Transaction domain', () => {
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

            await db.delete(payments).where(inArray(payments.userId, createdUserIds));
            await db
                .delete(transactions)
                .where(inArray(transactions.userId, createdUserIds));
            if (walletIds.length > 0) {
                await db.delete(wallets).where(inArray(wallets.id, walletIds));
            }
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

    describe('GET /api/v1/admin/transactions', () => {
        it('lists transactions across users with amount/direction', async () => {
            const admin = await createTestAdmin();
            const { user, transaction } = await createCompletedDeposit(500);

            const res = await listTransactionsReq(admin.cookie);

            expect(res.status).toBe(200);
            const found = res.body.data.find(
                (row: { id: string }) => row.id === transaction.id,
            );
            expect(found).toBeTruthy();
            expect(found.type).toBe('DEPOSIT');
            expect(found.direction).toBe('CREDIT');
            expect(found.amount).toBe(500);
            expect(found.user.id).toBe(user.userId);
        });

        it('filters by type and status', async () => {
            const admin = await createTestAdmin();
            const { transaction } = await createCompletedDeposit(500);

            const res = await listTransactionsReq(
                admin.cookie,
                '?type=DEPOSIT&status=COMPLETED',
            );

            expect(res.status).toBe(200);
            expect(
                res.body.data.some((row: { id: string }) => row.id === transaction.id),
            ).toBe(true);
        });

        it('searches by reference', async () => {
            const admin = await createTestAdmin();
            const { transaction } = await createCompletedDeposit(500);

            const res = await listTransactionsReq(
                admin.cookie,
                `?search=${transaction.referenceId}`,
            );

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toBe(transaction.id);
        });

        it('rejects a user token and unauthenticated requests', async () => {
            const user = await createTestUser();

            const userRes = await listTransactionsReq(user.userCookie);
            const anonRes = await request(app).get('/api/v1/admin/transactions');

            expect(userRes.status).toBe(401);
            expect(anonRes.status).toBe(401);
        });
    });

    describe('GET /api/v1/admin/transactions/:id', () => {
        it('returns detail with balanced ledger entries', async () => {
            const admin = await createTestAdmin();
            const { transaction } = await createCompletedDeposit(500);

            const res = await getTransactionReq(admin.cookie, transaction.id);

            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(transaction.id);
            expect(res.body.data.ledgerEntries).toHaveLength(1);
            expect(res.body.data.ledgerEntries[0]).toMatchObject({
                direction: 'CREDIT',
                amount: 500,
                currency: 'INR',
            });
        });

        it('returns 404 for a nonexistent transaction', async () => {
            const admin = await createTestAdmin();

            const res = await getTransactionReq(admin.cookie, randomUUID());

            expect(res.status).toBe(404);
        });

        it('exposes no mutation route for transactions', async () => {
            const admin = await createTestAdmin();
            const { transaction } = await createCompletedDeposit(500);

            const res = await request(app)
                .patch(`/api/v1/admin/transactions/${transaction.id}`)
                .set('Cookie', admin.cookie)
                .send({ status: 'FAILED' });

            expect(res.status).toBe(404);

            const unchanged = await getTransactionReq(admin.cookie, transaction.id);
            expect(unchanged.body.data.status).toBe('COMPLETED');
        });
    });
});
