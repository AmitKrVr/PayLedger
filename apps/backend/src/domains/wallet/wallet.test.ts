import { randomUUID } from 'node:crypto';

import {
    closeConnection,
    db,
    admins,
    adminSessions,
    users,
    wallets,
    AdminRole,
    AdminStatus,
    WalletStatus,
} from '@payledger/database';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import app from '../../app.js';
import { hashPassword } from '../../lib/auth/auth.js';

import { loginAdmin } from '../admin/auth/admin-auth.service.js';
import { register } from '../auth/auth.service.js';
import { findWalletByUserId } from './wallet.repository.js';

const ADMIN_PASSWORD = 'AdminPass123!';

const createdUserIds: string[] = [];
const createdAdminIds: string[] = [];

const createTestUser = async () => {
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

    const result = await register(
        {
            name: 'Wallet Test User',
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

    return {
        userId: result.user.id,
        walletId: wallet.id,
        cookie: `access_token=${result.accessToken}`,
    };
};

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

const getWalletReq = (cookie: string) =>
    request(app).get('/api/v1/wallet').set('Cookie', cookie);

describe('Wallet domain', () => {
    afterAll(async () => {
        for (const userId of createdUserIds) {
            await db.delete(wallets).where(eq(wallets.userId, userId));
            await db.delete(users).where(eq(users.id, userId));
        }

        for (const adminId of createdAdminIds) {
            await db
                .delete(adminSessions)
                .where(eq(adminSessions.adminId, adminId));
            await db.delete(admins).where(eq(admins.id, adminId));
        }

        await closeConnection();
    });

    describe('GET /api/v1/wallet', () => {
        it("returns the authenticated user's own wallet", async () => {
            const user = await createTestUser();

            const res = await getWalletReq(user.cookie);

            expect(res.status).toBe(200);
            expect(res.body.data).toMatchObject({
                id: user.walletId,
                balance: 0,
                held: 0,
                available: 0,
                status: 'ACTIVE',
            });
        });

        it('computes available as balance minus held', async () => {
            const user = await createTestUser();

            await db
                .update(wallets)
                .set({ balancePaise: 100000n, heldPaise: 30000n })
                .where(eq(wallets.id, user.walletId));

            const res = await getWalletReq(user.cookie);

            expect(res.status).toBe(200);
            expect(res.body.data).toMatchObject({
                balance: 1000,
                held: 300,
                available: 700,
            });
        });

        it('still returns the wallet state when the wallet is blocked', async () => {
            const user = await createTestUser();

            await db
                .update(wallets)
                .set({ status: WalletStatus.BLOCKED })
                .where(eq(wallets.id, user.walletId));

            const res = await getWalletReq(user.cookie);

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('BLOCKED');
        });

        it('rejects an unauthenticated request', async () => {
            const res = await request(app).get('/api/v1/wallet');
            expect(res.status).toBe(401);
        });

        it('rejects an admin access token (cross-role)', async () => {
            const admin = await createTestAdmin();

            const res = await getWalletReq(admin.cookie);

            expect(res.status).toBe(401);
        });
    });
});
