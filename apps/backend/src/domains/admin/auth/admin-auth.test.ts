import { randomUUID } from 'node:crypto';

import {
    closeConnection,
    db,
    admins,
    adminSessions,
    userSessions,
    users,
    wallets,
    AdminRole,
    AdminStatus,
} from '@payledger/database';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../../../app.js';
import { hashPassword } from '../../../lib/auth/auth.js';
import { connectRedis, disconnectRedis, redis } from '../../../lib/redis.js';

import { register } from '../../auth/auth.service.js';

const TEST_PASSWORD = 'AdminPass123!';

const createdAdminIds: string[] = [];
const createdUserIds: string[] = [];

const createTestAdmin = async (
    overrides: Partial<{ status: AdminStatus; role: AdminRole }> = {},
) => {
    const email = `admin.${randomUUID()}@example.com`;
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;
    const passwordHash = await hashPassword(TEST_PASSWORD);

    const [admin] = await db
        .insert(admins)
        .values({
            name: 'Test Admin',
            mobile,
            email,
            passwordHash,
            role: overrides.role ?? AdminRole.ADMIN,
            status: overrides.status ?? AdminStatus.ACTIVE,
        })
        .returning();

    if (!admin) {
        throw new Error('Failed to create test admin');
    }

    createdAdminIds.push(admin.id);

    return { id: admin.id, email, password: TEST_PASSWORD };
};

const createTestUserCookie = async (): Promise<string> => {
    const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

    const result = await register(
        { name: 'Admin Auth Test User', mobile, password: 'Password123!' },
        {},
    );

    createdUserIds.push(result.user.id);

    return `access_token=${result.accessToken}`;
};

const login = (email: string, password: string) =>
    request(app)
        .post('/api/v1/admin/auth/login')
        .send({ email, password });

const extractCookie = (res: request.Response, name: string): string => {
    const setCookie = res.headers['set-cookie'] as unknown as
        | string[]
        | undefined;
    const line = setCookie?.find((c) => c.startsWith(`${name}=`));

    if (!line) {
        throw new Error(`Cookie "${name}" not found in response`);
    }

    return line.split(';')[0]!;
};

const extractCookieAttributes = (
    res: request.Response,
    name: string,
): string => {
    const setCookie = res.headers['set-cookie'] as unknown as
        | string[]
        | undefined;
    const line = setCookie?.find((c) => c.startsWith(`${name}=`));

    if (!line) {
        throw new Error(`Cookie "${name}" not found in response`);
    }

    return line;
};

const cookieHeaderFromLogin = (res: request.Response): string =>
    `${extractCookie(res, 'access_token')}; ${extractCookie(res, 'refresh_token')}`;

const waitForNextJwtSecond = async (): Promise<void> => {
    const msIntoCurrentSecond = Date.now() % 1000;
    await new Promise((resolve) =>
        setTimeout(resolve, 1000 - msIntoCurrentSecond + 50),
    );
};

describe('Admin Auth domain', () => {
    beforeAll(async () => {
        // The login/refresh routes are rate-limited through the shared
        // Redis-backed middleware (reused as-is for admin, per spec) —
        // unlike the other domains' tests, this one goes through real
        // HTTP routes that hit it, so Redis needs to actually be connected.
        await connectRedis();
    });

    beforeEach(async () => {
        // Give every test its own fresh rate-limit budget instead of
        // sharing one 60s window across the whole suite (all requests
        // come from the same test-client IP).
        await redis.del('rate_limit:admin:login:127.0.0.1');
        await redis.del('rate_limit:admin:refresh:127.0.0.1');
    });

    afterAll(async () => {
        if (createdAdminIds.length > 0) {
            await db
                .delete(adminSessions)
                .where(inArray(adminSessions.adminId, createdAdminIds));
            await db.delete(admins).where(inArray(admins.id, createdAdminIds));
        }

        if (createdUserIds.length > 0) {
            await db
                .delete(wallets)
                .where(inArray(wallets.userId, createdUserIds));
            await db
                .delete(userSessions)
                .where(inArray(userSessions.userId, createdUserIds));
            await db.delete(users).where(inArray(users.id, createdUserIds));
        }

        await disconnectRedis();
        await closeConnection();
    });

    it('logs in with valid credentials', async () => {
        const admin = await createTestAdmin();

        const res = await login(admin.email, admin.password);

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({
            id: admin.id,
            email: admin.email,
            role: 'ADMIN',
        });
    });

    it('rejects an invalid email or password', async () => {
        const admin = await createTestAdmin();

        const wrongPassword = await login(admin.email, 'wrong-password');
        expect(wrongPassword.status).toBe(401);

        const unknownEmail = await login(
            `nope.${randomUUID()}@example.com`,
            TEST_PASSWORD,
        );
        expect(unknownEmail.status).toBe(401);
    });

    it('rejects login for a blocked admin', async () => {
        const admin = await createTestAdmin({ status: AdminStatus.BLOCKED });

        const res = await login(admin.email, admin.password);

        expect(res.status).toBe(401);
    });

    it('creates an admin session on login', async () => {
        const admin = await createTestAdmin();

        const res = await login(admin.email, admin.password);
        expect(res.status).toBe(200);

        const sessions = await db
            .select()
            .from(adminSessions)
            .where(eq(adminSessions.adminId, admin.id));

        expect(sessions).toHaveLength(1);
        expect(sessions[0]?.revokedAt).toBeNull();
    });

    it('sets HTTP-only auth cookies on login', async () => {
        const admin = await createTestAdmin();

        const res = await login(admin.email, admin.password);

        const accessCookie = extractCookieAttributes(res, 'access_token');
        const refreshCookie = extractCookieAttributes(res, 'refresh_token');

        expect(accessCookie).toMatch(/HttpOnly/i);
        expect(refreshCookie).toMatch(/HttpOnly/i);
    });

    it('never returns tokens in the response body', async () => {
        const admin = await createTestAdmin();

        const res = await login(admin.email, admin.password);
        const bodyText = JSON.stringify(res.body);

        expect(bodyText).not.toMatch(/accessToken/i);
        expect(bodyText).not.toMatch(/refreshToken/i);
    });

    it('does not leak the password hash anywhere in the response', async () => {
        const admin = await createTestAdmin();

        const loginRes = await login(admin.email, admin.password);
        const cookie = cookieHeaderFromLogin(loginRes);

        const meRes = await request(app)
            .get('/api/v1/admin/auth/me')
            .set('Cookie', cookie);

        const combined = JSON.stringify(loginRes.body) + JSON.stringify(meRes.body);

        expect(combined).not.toMatch(/passwordHash/i);
        expect(combined.toLowerCase()).not.toContain(TEST_PASSWORD.toLowerCase());
    });

    it('allows a valid admin access token through requireAdminAuth', async () => {
        const admin = await createTestAdmin();
        const loginRes = await login(admin.email, admin.password);
        const cookie = cookieHeaderFromLogin(loginRes);

        const res = await request(app)
            .get('/api/v1/admin/auth/me')
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({
            id: admin.id,
            name: 'Test Admin',
            email: admin.email,
            role: 'ADMIN',
        });
    });

    it('rejects a user access token on admin-only routes', async () => {
        const userCookie = await createTestUserCookie();

        const res = await request(app)
            .get('/api/v1/admin/auth/me')
            .set('Cookie', userCookie);

        expect(res.status).toBe(401);
    });

    it('refreshes the admin session and rotates the refresh token', async () => {
        const admin = await createTestAdmin();
        const loginRes = await login(admin.email, admin.password);
        const oldRefreshCookie = extractCookie(loginRes, 'refresh_token');
        const cookie = cookieHeaderFromLogin(loginRes);

        // JWT `iat` has 1-second resolution; without crossing a second
        // boundary, a same-second rotation re-signs an identical token
        // (same sub/jti/iat/exp). This is a deterministic wait for a
        // known precision limit, not timing-based flakiness.
        await waitForNextJwtSecond();

        const refreshRes = await request(app)
            .post('/api/v1/admin/auth/refresh')
            .set('Cookie', cookie);

        expect(refreshRes.status).toBe(200);

        const newRefreshCookie = extractCookie(refreshRes, 'refresh_token');
        expect(newRefreshCookie).not.toBe(oldRefreshCookie);
    });

    it('rejects reuse of a refresh token after rotation', async () => {
        const admin = await createTestAdmin();
        const loginRes = await login(admin.email, admin.password);
        const cookie = cookieHeaderFromLogin(loginRes);
        const accessCookie = extractCookie(loginRes, 'access_token');
        const oldRefreshCookie = extractCookie(loginRes, 'refresh_token');

        await waitForNextJwtSecond();

        const firstRefresh = await request(app)
            .post('/api/v1/admin/auth/refresh')
            .set('Cookie', cookie);
        expect(firstRefresh.status).toBe(200);

        // Replay the old (now-rotated-away) refresh token.
        const replay = await request(app)
            .post('/api/v1/admin/auth/refresh')
            .set('Cookie', `${accessCookie}; ${oldRefreshCookie}`);

        expect(replay.status).toBe(401);

        // Token-reuse detection revokes the whole session, so even the
        // NEW refresh token issued by the first refresh must now fail.
        const newRefreshCookie = extractCookie(firstRefresh, 'refresh_token');
        const afterReuse = await request(app)
            .post('/api/v1/admin/auth/refresh')
            .set('Cookie', `${accessCookie}; ${newRefreshCookie}`);

        expect(afterReuse.status).toBe(401);
    });

    it('rejects refresh for a revoked session', async () => {
        const admin = await createTestAdmin();
        const loginRes = await login(admin.email, admin.password);
        const cookie = cookieHeaderFromLogin(loginRes);

        const logoutRes = await request(app)
            .post('/api/v1/admin/auth/logout')
            .set('Cookie', cookie);
        expect(logoutRes.status).toBe(200);

        const refreshRes = await request(app)
            .post('/api/v1/admin/auth/refresh')
            .set('Cookie', cookie);

        expect(refreshRes.status).toBe(401);
    });

    it('rejects refresh for an expired session', async () => {
        const admin = await createTestAdmin();
        const loginRes = await login(admin.email, admin.password);
        const cookie = cookieHeaderFromLogin(loginRes);

        await db
            .update(adminSessions)
            .set({ expiresAt: new Date(Date.now() - 1000) })
            .where(eq(adminSessions.adminId, admin.id));

        const refreshRes = await request(app)
            .post('/api/v1/admin/auth/refresh')
            .set('Cookie', cookie);

        expect(refreshRes.status).toBe(401);
    });

    it('revokes the current session on logout', async () => {
        const admin = await createTestAdmin();
        const loginRes = await login(admin.email, admin.password);
        const cookie = cookieHeaderFromLogin(loginRes);

        const logoutRes = await request(app)
            .post('/api/v1/admin/auth/logout')
            .set('Cookie', cookie);
        expect(logoutRes.status).toBe(200);

        const [session] = await db
            .select()
            .from(adminSessions)
            .where(eq(adminSessions.adminId, admin.id));

        expect(session?.revokedAt).not.toBeNull();
    });

    it('clears auth cookies on logout', async () => {
        const admin = await createTestAdmin();
        const loginRes = await login(admin.email, admin.password);
        const cookie = cookieHeaderFromLogin(loginRes);

        const logoutRes = await request(app)
            .post('/api/v1/admin/auth/logout')
            .set('Cookie', cookie);

        const accessCookie = extractCookieAttributes(
            logoutRes,
            'access_token',
        );
        const refreshCookie = extractCookieAttributes(
            logoutRes,
            'refresh_token',
        );

        expect(accessCookie).toMatch(/access_token=;/);
        expect(refreshCookie).toMatch(/refresh_token=;/);
    });

    it('keeps multiple sessions for the same admin independent', async () => {
        const admin = await createTestAdmin();

        const sessionA = await login(admin.email, admin.password);
        const sessionB = await login(admin.email, admin.password);

        const cookieA = cookieHeaderFromLogin(sessionA);
        const cookieB = cookieHeaderFromLogin(sessionB);

        const logoutA = await request(app)
            .post('/api/v1/admin/auth/logout')
            .set('Cookie', cookieA);
        expect(logoutA.status).toBe(200);

        // Session A is gone, session B must be unaffected.
        const meB = await request(app)
            .get('/api/v1/admin/auth/me')
            .set('Cookie', cookieB);
        expect(meB.status).toBe(200);

        const refreshB = await request(app)
            .post('/api/v1/admin/auth/refresh')
            .set('Cookie', cookieB);
        expect(refreshB.status).toBe(200);

        const sessions = await db
            .select()
            .from(adminSessions)
            .where(eq(adminSessions.adminId, admin.id));
        expect(sessions).toHaveLength(2);
        expect(sessions.filter((s) => s.revokedAt !== null)).toHaveLength(1);
    });

    it('GET /admin/auth/me returns only safe admin fields', async () => {
        const admin = await createTestAdmin({ role: AdminRole.SUPER_ADMIN });
        const loginRes = await login(admin.email, admin.password);
        const cookie = cookieHeaderFromLogin(loginRes);

        const res = await request(app)
            .get('/api/v1/admin/auth/me')
            .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(Object.keys(res.body.data).sort()).toEqual(
            ['email', 'id', 'name', 'role'].sort(),
        );
        expect(res.body.data.role).toBe('SUPER_ADMIN');
    });
});
