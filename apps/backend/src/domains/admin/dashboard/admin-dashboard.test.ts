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
    withdrawals,
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
import { findWalletByUserId } from '../../wallet/wallet.repository.js';
import { createWithdrawal } from '../../withdrawal/withdrawal.service.js';
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
            name: `Admin Dashboard Test ${Math.random().toString(36).slice(2, 8)}`,
            mobile,
            password: 'Password123!',
        },
        {},
    );

    createdUserIds.push(result.user.id);

    return { userId: result.user.id };
};

const getDashboardReq = (cookie: string) =>
    request(app).get('/api/v1/admin/dashboard').set('Cookie', cookie);

describe('Admin Dashboard domain', () => {
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
                await db.delete(withdrawals).where(inArray(withdrawals.walletId, walletIds));
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

    it('reflects a new pending withdrawal in the pending withdrawal stats', async () => {
        const admin = await createTestAdmin();
        const before = await getDashboardReq(admin.cookie);

        const user = await createTestUser();
        const wallet = await findWalletByUserId(user.userId);
        if (!wallet) throw new Error('wallet missing');
        await db.update(wallets).set({ balancePaise: 100000n }).where(
            inArray(wallets.id, [wallet.id]),
        );
        await createWithdrawal(user.userId, { amount: 200 }, randomUUID());

        const after = await getDashboardReq(admin.cookie);

        expect(after.status).toBe(200);
        expect(after.body.data.stats.pendingWithdrawals.count).toBe(
            before.body.data.stats.pendingWithdrawals.count + 1,
        );
        expect(after.body.data.stats.pendingWithdrawals.amount).toBe(
            before.body.data.stats.pendingWithdrawals.amount + 200,
        );
    });

    it("reflects today's completed deposit amount, never a fabricated number", async () => {
        const admin = await createTestAdmin();
        const before = await getDashboardReq(admin.cookie);

        const user = await createTestUser();
        const orderId = `ORD${randomUUID().slice(0, 8)}`;
        const gatewayPaymentId = randomUUID();

        await db.insert(payments).values({
            userId: user.userId,
            orderId,
            paymentId: gatewayPaymentId,
            provider: 'FAKE_GATEWAY',
            amountPaise: 75000n,
            status: 'CREATED',
            idempotencyKey: randomUUID(),
        });

        await processPaymentWebhook({
            orderId,
            paymentId: gatewayPaymentId,
            status: 'SUCCESS',
            amount: 75000,
        });

        const after = await getDashboardReq(admin.cookie);

        expect(after.body.data.stats.todaysDeposits.count).toBe(
            before.body.data.stats.todaysDeposits.count + 1,
        );
        expect(after.body.data.stats.todaysDeposits.amount).toBe(
            before.body.data.stats.todaysDeposits.amount + 750,
        );
    });

    it('includes the new deposit in recent payments', async () => {
        const admin = await createTestAdmin();
        const user = await createTestUser();
        const orderId = `ORD${randomUUID().slice(0, 8)}`;
        const gatewayPaymentId = randomUUID();

        await db.insert(payments).values({
            userId: user.userId,
            orderId,
            paymentId: gatewayPaymentId,
            provider: 'FAKE_GATEWAY',
            amountPaise: 10000n,
            status: 'SUCCESS',
            idempotencyKey: randomUUID(),
            paidAt: new Date(),
        });

        const res = await getDashboardReq(admin.cookie);

        expect(res.status).toBe(200);
        expect(
            res.body.data.recentPayments.some(
                (row: { orderId: string }) => row.orderId === orderId,
            ),
        ).toBe(true);
    });

    it('rejects a non-admin and unauthenticated request', async () => {
        const anonRes = await request(app).get('/api/v1/admin/dashboard');

        expect(anonRes.status).toBe(401);
    });
});
