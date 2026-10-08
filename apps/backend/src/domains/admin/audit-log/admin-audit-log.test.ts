import { randomUUID } from 'node:crypto';

import {
    closeConnection,
    db,
    admins,
    adminSessions,
    AdminRole,
    AdminStatus,
} from '@payledger/database';
import { inArray } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import app from '../../../app.js';
import { hashPassword } from '../../../lib/auth/auth.js';

import { loginAdmin } from '../auth/admin-auth.service.js';

const ADMIN_PASSWORD = 'AdminPass123!';

const createdAdminIds: string[] = [];

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

const listAuditLogsReq = (cookie: string, query = '') =>
    request(app).get(`/api/v1/admin/audit-logs${query}`).set('Cookie', cookie);

describe('Admin Audit Log domain', () => {
    afterAll(async () => {
        if (createdAdminIds.length > 0) {
            await db
                .delete(adminSessions)
                .where(inArray(adminSessions.adminId, createdAdminIds));
            await db.delete(admins).where(inArray(admins.id, createdAdminIds));
        }

        await closeConnection();
    });

    describe('GET /api/v1/admin/audit-logs', () => {
        it("records the admin's own login and the list surfaces it", async () => {
            const admin = await createTestAdmin();

            const res = await listAuditLogsReq(admin.cookie, `?adminId=${admin.id}`);

            expect(res.status).toBe(200);
            const loginEntry = res.body.data.find(
                (row: { action: string }) => row.action === 'ADMIN_LOGIN',
            );
            expect(loginEntry).toBeTruthy();
            expect(loginEntry.actor.type).toBe('ADMIN');
            expect(loginEntry.actor.name).toBe('Test Admin');
            expect(loginEntry).not.toHaveProperty('passwordHash');
            expect(JSON.stringify(loginEntry)).not.toMatch(/password/i);
        });

        it('filters by action', async () => {
            const admin = await createTestAdmin();

            const res = await listAuditLogsReq(
                admin.cookie,
                `?adminId=${admin.id}&action=ADMIN_LOGIN`,
            );

            expect(res.status).toBe(200);
            expect(
                res.body.data.every(
                    (row: { action: string }) => row.action === 'ADMIN_LOGIN',
                ),
            ).toBe(true);
        });

        it('filters by targetType', async () => {
            const admin = await createTestAdmin();

            const res = await listAuditLogsReq(
                admin.cookie,
                `?adminId=${admin.id}&targetType=ADMIN`,
            );

            expect(res.status).toBe(200);
            expect(
                res.body.data.every(
                    (row: { targetType: string }) => row.targetType === 'ADMIN',
                ),
            ).toBe(true);
        });

        it('paginates results', async () => {
            const admin = await createTestAdmin();

            const res = await listAuditLogsReq(admin.cookie, '?page=1&limit=1');

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeLessThanOrEqual(1);
            expect(res.body.meta.limit).toBe(1);
        });

        it('rejects a non-admin and an unauthenticated request', async () => {
            const anonRes = await request(app).get('/api/v1/admin/audit-logs');

            expect(anonRes.status).toBe(401);
        });
    });
});
