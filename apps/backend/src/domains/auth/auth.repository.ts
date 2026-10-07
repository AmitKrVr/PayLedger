import { and, eq, isNull } from 'drizzle-orm';

import {
    db,
    users,
    userSessions,
    wallets,
    UserStatus,
    WalletStatus,
    WalletType,
    type DatabaseOrTransaction,
} from '@payledger/database';

import type { CreateUserSessionInput } from './auth.types.js';

export const findUserByMobile = async (
    mobile: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [user] = await executor
        .select()
        .from(users)
        .where(eq(users.mobile, mobile))
        .limit(1);

    return user ?? null;
};

export const findUserByMobileForUpdate = async (
    mobile: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [user] = await executor
        .select()
        .from(users)
        .where(eq(users.mobile, mobile))
        .for('update')
        .limit(1);

    return user ?? null;
};

export const findUserByEmail = async (
    email: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [user] = await executor
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    return user ?? null;
};

export const findUserById = async (
    id: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [user] = await executor
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

    return user ?? null;
};

export const createUser = async (
    data: {
        name: string;
        mobile: string;
        email?: string | null;
        passwordHash: string;
        status?: UserStatus;
    },
    executor: DatabaseOrTransaction = db,
) => {
    const [user] = await executor
        .insert(users)
        .values({
            name: data.name,
            mobile: data.mobile,
            email: data.email ?? null,
            passwordHash: data.passwordHash,
            status: data.status ?? UserStatus.ACTIVE,
        })
        .returning();

    if (!user) {
        throw new Error('Failed to create user');
    }

    return user;
};

export const createWallet = async (
    data: {
        userId: string;
    },
    executor: DatabaseOrTransaction = db,
) => {
    const [wallet] = await executor
        .insert(wallets)
        .values({
            userId: data.userId,
            walletType: WalletType.USER,
            status: WalletStatus.ACTIVE,
        })
        .returning();

    if (!wallet) {
        throw new Error('Failed to create wallet');
    }

    return wallet;
};

export const createSession = async (
    data: CreateUserSessionInput,
    executor: DatabaseOrTransaction = db,
) => {
    const [session] = await executor
        .insert(userSessions)
        .values({
            userId: data.userId,
            refreshTokenHash: data.refreshTokenHash,
            refreshTokenJti: data.refreshTokenJti,
            expiresAt: data.expiresAt,
            deviceName: data.deviceName ?? null,
            ipAddress: data.ipAddress ?? null,
            userAgent: data.userAgent ?? null,
        })
        .returning();

    if (!session) {
        throw new Error('Failed to create session');
    }

    return session;
};

export const findSessionById = async (
    id: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [session] = await executor
        .select()
        .from(userSessions)
        .where(eq(userSessions.id, id))
        .limit(1);

    return session ?? null;
};

export const findSessionByJti = async (
    jti: string,
    executor: DatabaseOrTransaction = db,
    forUpdate = false,
) => {
    const query = executor
        .select()
        .from(userSessions)
        .where(eq(userSessions.refreshTokenJti, jti));

    const [session] = forUpdate
        ? await query.for('update').limit(1)
        : await query.limit(1);

    return session ?? null;
};
export const updateSessionToken = async (
    id: string,
    data: {
        refreshTokenJti: string;
        refreshTokenHash: string;
        lastUsedAt: Date;
    },
    executor: DatabaseOrTransaction = db,
) => {
    const [session] = await executor
        .update(userSessions)
        .set({
            refreshTokenJti: data.refreshTokenJti,
            refreshTokenHash: data.refreshTokenHash,
            lastUsedAt: data.lastUsedAt,
            updatedAt: new Date(),
        })
        .where(eq(userSessions.id, id))
        .returning();

    return session ?? null;
};

export const revokeSession = async (
    id: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [session] = await executor
        .update(userSessions)
        .set({
            revokedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(userSessions.id, id),
                isNull(userSessions.revokedAt),
            ),
        )
        .returning();

    return session ?? null;
};

export const revokeSessionByJti = async (
    jti: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [session] = await executor
        .update(userSessions)
        .set({
            revokedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(userSessions.refreshTokenJti, jti),
                isNull(userSessions.revokedAt),
            ),
        )
        .returning();

    return session ?? null;
};

export const updateUserLoginSuccess = async (
    userId: string,
    executor: DatabaseOrTransaction = db,
) => {
    const [user] = await executor
        .update(users)
        .set({
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

    return user ?? null;
};

export const updateUserFailedLogin = async (
    userId: string,
    failedAttempts: number,
    lockedUntil: Date | null,
    executor: DatabaseOrTransaction = db,
) => {
    const [user] = await executor
        .update(users)
        .set({
            failedLoginAttempts: failedAttempts,
            lockedUntil,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

    return user ?? null;
};