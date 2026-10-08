import { randomUUID } from 'node:crypto';

import {
    closeConnection,
    db,
    admins,
    adminSessions,
    payments,
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
import { createPayment } from '../../payment/payment.service.js';

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
            name: `Admin Payment Test ${Math.random().toString(36).slice(2, 8)}`,
            mobile,
            password: 'Password123!',
        },
        {},
    );

    createdUserIds.push(result.user.id);

    return { userId: result.user.id, userCookie: `access_token=${result.accessToken}` };
};

const GATEWAY_URL = 'http://127.0.0.1:1';

const createTestPayment = async (amountInr: number) => {
    const user = await createTestUser();

    // No live gateway needed for list/detail tests -- the created
    // payment's own row is what's under test, not the gateway round
    // trip (already covered in payment.test.ts). An unreachable gateway
    // still leaves a real payment row behind, just FAILED instead of
    // CREATED, which is fine for read-only admin list/detail assertions.
    let payment;
    try {
        payment = await createPayment(
            user.userId,
            { amount: amountInr },
            randomUUID(),
            GATEWAY_URL,
        );
    } catch {
        const rows = await db
            .select()
            .from(payments)
            .where(inArray(payments.userId, [user.userId]));
        payment = rows[0]!;
    }

    return { user, payment };
};

const listPaymentsReq = (cookie: string, query = '') =>
    request(app).get(`/api/v1/admin/payments${query}`).set('Cookie', cookie);

const getPaymentReq = (cookie: string, id: string) =>
    request(app).get(`/api/v1/admin/payments/${id}`).set('Cookie', cookie);

describe('Admin Payment domain', () => {
    afterAll(async () => {
        if (createdUserIds.length > 0) {
            await db.delete(payments).where(inArray(payments.userId, createdUserIds));
            await db.delete(wallets).where(inArray(wallets.userId, createdUserIds));
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

    describe('GET /api/v1/admin/payments', () => {
        it('lists payments for any user, not just the admin', async () => {
            const admin = await createTestAdmin();
            const { user, payment } = await createTestPayment(500);

            const res = await listPaymentsReq(admin.cookie);

            expect(res.status).toBe(200);
            const found = res.body.data.find(
                (row: { id: string }) => row.id === payment.id,
            );
            expect(found).toBeTruthy();
            expect(found.amount).toBe(500);
            expect(found.user.id).toBe(user.userId);
        });

        it('filters by status', async () => {
            const admin = await createTestAdmin();
            const { payment } = await createTestPayment(500);

            const res = await listPaymentsReq(admin.cookie, `?status=${payment.status}`);

            expect(res.status).toBe(200);
            expect(
                res.body.data.every(
                    (row: { status: string }) => row.status === payment.status,
                ),
            ).toBe(true);
        });

        it('searches by orderId', async () => {
            const admin = await createTestAdmin();
            const { payment } = await createTestPayment(500);

            const res = await listPaymentsReq(admin.cookie, `?search=${payment.orderId}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toBe(payment.id);
        });

        it('rejects a user token', async () => {
            const user = await createTestUser();

            const res = await listPaymentsReq(user.userCookie);

            expect(res.status).toBe(401);
        });

        it('rejects an unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/admin/payments');

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/admin/payments/:id', () => {
        it("returns full detail regardless of which user owns it", async () => {
            const admin = await createTestAdmin();
            const { user, payment } = await createTestPayment(500);

            const res = await getPaymentReq(admin.cookie, payment.id);

            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(payment.id);
            expect(res.body.data.orderId).toBe(payment.orderId);
            expect(res.body.data.user.id).toBe(user.userId);
            expect(res.body.data.currency).toBe('INR');
        });

        it('returns 404 for a nonexistent payment', async () => {
            const admin = await createTestAdmin();

            const res = await getPaymentReq(admin.cookie, randomUUID());

            expect(res.status).toBe(404);
        });
    });
});
