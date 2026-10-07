import { and, eq, isNull } from 'drizzle-orm';

import {
    db,
    admins,
    adminSessions,
    type DatabaseOrTransaction,
} from '@payledger/database';

import type { CreateAdminSessionInput } from '../auth/auth.types.js';

export const findAdminByEmail = async (
    email: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [admin] = await executor
        .select()
        .from(admins)
        .where(eq(admins.email, email))
        .limit(1);

    return admin ?? null;
};

export const findAdminByEmailForUpdate = async (
    email: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [admin] = await executor
        .select()
        .from(admins)
        .where(eq(admins.email, email))
        .for('update')
        .limit(1);

    return admin ?? null;
};

export const findAdminById = async (
    id: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [admin] = await executor
        .select()
        .from(admins)
        .where(eq(admins.id, id))
        .limit(1);

    return admin ?? null;
};

export const createAdminSession = async (
    data: CreateAdminSessionInput,
    executor: DatabaseOrTransaction = db,
) => {
    const [session] = await executor
        .insert(adminSessions)
        .values({
            adminId: data.adminId,
            refreshTokenHash: data.refreshTokenHash,
            refreshTokenJti: data.refreshTokenJti,
            expiresAt: data.expiresAt,
            deviceName: data.deviceName ?? null,
            ipAddress: data.ipAddress ?? null,
            userAgent: data.userAgent ?? null,
        })
        .returning();

    if (!session) {
        throw new Error('Failed to create admin session');
    }

    return session;
};

export const findAdminSessionByJti = async (
    jti: string,
    executor: DatabaseOrTransaction = db,
    forUpdate = false,
) => {
    const query = executor
        .select()
        .from(adminSessions)
        .where(eq(adminSessions.refreshTokenJti, jti));

    const [session] = forUpdate
        ? await query.for('update').limit(1)
        : await query.limit(1);

    return session ?? null;
};

export const updateAdminSessionToken = async (
    id: string,
    data: {
        refreshTokenJti: string;
        refreshTokenHash: string;
        lastUsedAt: Date;
    },
    executor: DatabaseOrTransaction = db,
) => {
    const [session] = await executor
        .update(adminSessions)
        .set({
            refreshTokenJti: data.refreshTokenJti,
            refreshTokenHash: data.refreshTokenHash,
            lastUsedAt: data.lastUsedAt,
            updatedAt: new Date(),
        })
        .where(eq(adminSessions.id, id))
        .returning();

    return session ?? null;
};

export const revokeAdminSession = async (
    id: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [session] = await executor
        .update(adminSessions)
        .set({
            revokedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(adminSessions.id, id),
                isNull(adminSessions.revokedAt),
            ),
        )
        .returning();

    return session ?? null;
};

export const revokeAdminSessionByJti = async (
    jti: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [session] = await executor
        .update(adminSessions)
        .set({
            revokedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(adminSessions.refreshTokenJti, jti),
                isNull(adminSessions.revokedAt),
            ),
        )
        .returning();

    return session ?? null;
};

export const updateAdminLoginSuccess = async (
    adminId: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [admin] = await executor
        .update(admins)
        .set({
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(admins.id, adminId))
        .returning();

    return admin ?? null;
};

export const updateAdminFailedLogin = async (
    adminId: string,
    failedAttempts: number,
    lockedUntil: Date | null,
    executor: DatabaseOrTransaction = db,
) => {
    const [admin] = await executor
        .update(admins)
        .set({
            failedLoginAttempts: failedAttempts,
            lockedUntil,
            updatedAt: new Date(),
        })
        .where(eq(admins.id, adminId))
        .returning();

    return admin ?? null;
};
