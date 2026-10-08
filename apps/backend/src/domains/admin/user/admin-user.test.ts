import { randomUUID } from 'node:crypto';

import {
    closeConnection,
    db,
    admins,
    adminSessions,
    ledgerEntries,
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

const createTestUser = async (nameSuffix: string) => {
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

    const result = await register(
        {
            name: `Admin User Test ${nameSuffix}`,
            mobile,
            password: 'Password123!',
        },
        {},
    );

    createdUserIds.push(result.user.id);

    return {
        userId: result.user.id,
        mobile,
        userCookie: `access_token=${result.accessToken}`,
    };
};

const listUsersReq = (cookie: string, query = '') =>
    request(app).get(`/api/v1/admin/users${query}`).set('Cookie', cookie);

const getUserReq = (cookie: string, id: string) =>
    request(app).get(`/api/v1/admin/users/${id}`).set('Cookie', cookie);

describe('Admin User domain', () => {
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

    describe('GET /api/v1/admin/users', () => {
        it('lists users with wallet summary', async () => {
            const admin = await createTestAdmin();
            const user = await createTestUser(randomUUID().slice(0, 8));

            const res = await listUsersReq(admin.cookie);

            expect(res.status).toBe(200);
            const found = res.body.data.find(
                (row: { id: string }) => row.id === user.userId,
            );
            expect(found).toBeTruthy();
            expect(found.wallet).toMatchObject({
                status: 'ACTIVE',
                balance: 0,
                held: 0,
                available: 0,
            });
            expect(found).not.toHaveProperty('passwordHash');
        });

        it('searches by name', async () => {
            const admin = await createTestAdmin();
            const suffix = randomUUID().slice(0, 8);
            const user = await createTestUser(suffix);

            const res = await listUsersReq(
                admin.cookie,
                `?search=${encodeURIComponent(suffix)}`,
            );

            expect(res.status).toBe(200);
            expect(
                res.body.data.some((row: { id: string }) => row.id === user.userId),
            ).toBe(true);
        });

        it('searches by mobile', async () => {
            const admin = await createTestAdmin();
            const user = await createTestUser(randomUUID().slice(0, 8));

            const res = await listUsersReq(admin.cookie, `?search=${user.mobile}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toBe(user.userId);
        });

        it('rejects a user token', async () => {
            const user = await createTestUser(randomUUID().slice(0, 8));

            const res = await listUsersReq(user.userCookie);

            expect(res.status).toBe(401);
        });

        it('rejects an unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/admin/users');

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/admin/users/:id', () => {
        it("returns the user's profile, wallet, and recent activity", async () => {
            const admin = await createTestAdmin();
            const user = await createTestUser(randomUUID().slice(0, 8));

            const res = await getUserReq(admin.cookie, user.userId);

            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(user.userId);
            expect(res.body.data.wallet).toBeTruthy();
            expect(res.body.data.recentTransactions).toEqual([]);
            expect(res.body.data.recentPayments).toEqual([]);
            expect(res.body.data.recentWithdrawals).toEqual([]);
            expect(res.body.data).not.toHaveProperty('passwordHash');
        });

        it('returns 404 for a nonexistent user', async () => {
            const admin = await createTestAdmin();

            const res = await getUserReq(admin.cookie, randomUUID());

            expect(res.status).toBe(404);
        });

        it('admin token is accepted, user token is rejected for the same route', async () => {
            const admin = await createTestAdmin();
            const user = await createTestUser(randomUUID().slice(0, 8));

            const adminRes = await getUserReq(admin.cookie, user.userId);
            const userRes = await getUserReq(user.userCookie, user.userId);

            expect(adminRes.status).toBe(200);
            expect(userRes.status).toBe(401);
        });
    });
});
