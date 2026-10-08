import { randomUUID } from 'node:crypto';

import { env } from '@payledger/config';
import {
    db,
    AdminStatus,
    type AdminRole,
    type DatabaseOrTransaction,
    type admins,
} from '@payledger/database';

import { ERROR_CODES } from '../../../constants/response.constants.js';
import { ERROR_MESSAGES } from '../../../constants/message.constants.js';
import {
    getDummyPasswordHash,
    hashRefreshToken,
    verifyPassword,
} from '../../../lib/auth/auth.js';
import {
    createAdminAccessToken,
    createRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
} from '../../../lib/auth/jwt.js';
import { AuthenticationError } from '../../../middleware/error.middleware.js';

import { auditService } from '../../audit/audit.service.js';
import type { RequestContext } from '../../auth/auth.types.js';

import {
    createAdminSession,
    findAdminByEmailForUpdate,
    findAdminById,
    findAdminSessionByJti,
    revokeAdminSession,
    revokeAdminSessionByJti,
    updateAdminFailedLogin,
    updateAdminLoginSuccess,
    updateAdminSessionToken,
} from './admin-auth.repository.js';
import type { AdminLoginInput } from './admin-auth.validator.js';

type AdminSummary = {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
};

type AdminAuthResult = {
    admin: AdminSummary;
    accessToken: string;
    refreshToken: string;
};

const sanitizeAdmin = (
    admin: typeof admins.$inferSelect,
): AdminSummary => ({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
});

const getAdminSessionExpiry = (): Date =>
    new Date(
        Date.now() + env.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

const logAdminLoginFailure = (
    tx: DatabaseOrTransaction,
    context: RequestContext,
    adminId: string | null,
    reason: string,
    extra?: Record<string, unknown>,
): Promise<void> =>
    auditService.log(
        {
            category: 'AUTH',
            action: 'ADMIN_LOGIN',
            status: 'FAILURE',
            actorType: adminId ? 'ADMIN' : 'SYSTEM',
            actorAdminId: adminId,
            targetType: 'ADMIN',
            targetId: adminId,
            metadata: { reason, ...extra },
            requestId: context.requestId ?? null,
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null,
        },
        tx,
    );

export const loginAdmin = async (
    input: AdminLoginInput,
    context: RequestContext,
): Promise<AdminAuthResult> => {
    return db.transaction(async (tx) => {
        const lockedAdmin = await findAdminByEmailForUpdate(
            input.email,
            tx,
        );

        // Always pay the Argon2 cost, even for an unknown email, so
        // "no such account" and "wrong password" take the same time.
        const passwordValid = await verifyPassword(
            lockedAdmin
                ? lockedAdmin.passwordHash
                : await getDummyPasswordHash(),
            input.password,
        );

        if (!lockedAdmin) {
            await logAdminLoginFailure(
                tx,
                context,
                null,
                'INVALID_CREDENTIALS',
            );

            throw new AuthenticationError(
                ERROR_MESSAGES.INVALID_CREDENTIALS_ADMIN,
                ERROR_CODES.INVALID_CREDENTIALS,
            );
        }

        if (lockedAdmin.status !== AdminStatus.ACTIVE) {
            await logAdminLoginFailure(
                tx,
                context,
                lockedAdmin.id,
                'ACCOUNT_BLOCKED',
            );

            throw new AuthenticationError(
                ERROR_MESSAGES.INVALID_CREDENTIALS_ADMIN,
                ERROR_CODES.INVALID_CREDENTIALS,
            );
        }

        const now = new Date();
        const lockExpired =
            lockedAdmin.lockedUntil !== null &&
            lockedAdmin.lockedUntil <= now;

        // An account that's still locked is rejected outright, without
        // touching the failed-attempt counter — see auth.service.ts's
        // login() for why (letting failed attempts during an active lock
        // extend lockedUntil would let an attacker keep the real admin
        // locked out indefinitely).
        if (lockedAdmin.lockedUntil !== null && !lockExpired) {
            await logAdminLoginFailure(
                tx,
                context,
                lockedAdmin.id,
                'ACCOUNT_LOCKED',
            );

            throw new AuthenticationError(
                ERROR_MESSAGES.ACCOUNT_LOCKED,
                ERROR_CODES.ACCOUNT_LOCKED,
            );
        }

        if (!passwordValid) {
            const newFailed =
                (lockExpired ? 0 : lockedAdmin.failedLoginAttempts) +
                1;

            if (newFailed >= env.AUTH_MAX_FAILED_LOGIN_ATTEMPTS) {
                const lockedUntil = new Date(
                    Date.now() +
                    env.AUTH_LOCK_DURATION_MINUTES * 60 * 1000,
                );

                await updateAdminFailedLogin(
                    lockedAdmin.id,
                    0,
                    lockedUntil,
                    tx,
                );

                await logAdminLoginFailure(
                    tx,
                    context,
                    lockedAdmin.id,
                    'ACCOUNT_LOCKED',
                    { attempts: newFailed },
                );

                throw new AuthenticationError(
                    ERROR_MESSAGES.ACCOUNT_LOCKED,
                    ERROR_CODES.ACCOUNT_LOCKED,
                );
            }

            await updateAdminFailedLogin(
                lockedAdmin.id,
                newFailed,
                null,
                tx,
            );

            await logAdminLoginFailure(
                tx,
                context,
                lockedAdmin.id,
                'INVALID_CREDENTIALS',
                { attempts: newFailed },
            );

            throw new AuthenticationError(
                ERROR_MESSAGES.INVALID_CREDENTIALS,
                ERROR_CODES.INVALID_CREDENTIALS,
            );
        }

        const updatedAdmin = await updateAdminLoginSuccess(
            lockedAdmin.id,
            tx,
        );

        if (!updatedAdmin) {
            throw new Error('Failed to update admin login state');
        }

        const refreshTokenJti = randomUUID();

        const refreshToken = await createRefreshToken({
            sub: updatedAdmin.id,
            jti: refreshTokenJti,
        });

        const session = await createAdminSession(
            {
                adminId: updatedAdmin.id,
                refreshTokenJti,
                refreshTokenHash: hashRefreshToken(refreshToken),
                expiresAt: getAdminSessionExpiry(),
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                deviceName: context.deviceName,
            },
            tx,
        );

        const accessToken = await createAdminAccessToken({
            sub: updatedAdmin.id,
            sid: session.id,
            role: updatedAdmin.role,
        });

        await auditService.log(
            {
                category: 'AUTH',
                action: 'ADMIN_LOGIN',
                status: 'SUCCESS',
                actorType: 'ADMIN',
                actorAdminId: updatedAdmin.id,
                targetType: 'ADMIN',
                targetId: updatedAdmin.id,
                requestId: context.requestId ?? null,
                ipAddress: context.ipAddress ?? null,
                userAgent: context.userAgent ?? null,
            },
            tx,
        );

        return {
            admin: sanitizeAdmin(updatedAdmin),
            accessToken,
            refreshToken,
        };
    });
};

export const refreshAdmin = async (
    refreshToken: string | undefined,
    context: RequestContext,
): Promise<{
    accessToken: string;
    refreshToken: string;
}> => {
    if (!refreshToken) {
        throw new AuthenticationError(
            ERROR_MESSAGES.UNAUTHORIZED,
            ERROR_CODES.UNAUTHORIZED,
        );
    }

    let payload: {
        sub?: string;
        jti?: string;
    };

    try {
        const verified = await verifyRefreshToken(refreshToken);

        payload = {
            sub:
                typeof verified.payload.sub === 'string'
                    ? verified.payload.sub
                    : undefined,
            jti:
                typeof verified.payload.jti === 'string'
                    ? verified.payload.jti
                    : undefined,
        };
    } catch {
        throw new AuthenticationError(
            ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
            ERROR_CODES.INVALID_REFRESH_TOKEN,
        );
    }

    if (!payload.sub || !payload.jti) {
        throw new AuthenticationError(
            ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
            ERROR_CODES.INVALID_REFRESH_TOKEN,
        );
    }

    const presentedHash = hashRefreshToken(refreshToken);

    // Revoking a session and then throwing from inside the SAME
    // transaction would roll the revocation back along with everything
    // else — so the two "detected something wrong, kill the session"
    // branches below commit that revocation and return a sentinel
    // instead of throwing; the actual rejection is thrown once the
    // transaction has already committed.
    const result = await db.transaction(async (tx) => {
        const session = await findAdminSessionByJti(
            payload.jti!,
            tx,
            true,
        );

        if (!session || session.adminId !== payload.sub) {
            throw new AuthenticationError(
                ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
                ERROR_CODES.INVALID_REFRESH_TOKEN,
            );
        }

        if (session.revokedAt) {
            throw new AuthenticationError(
                ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
                ERROR_CODES.INVALID_REFRESH_TOKEN,
            );
        }

        if (session.expiresAt <= new Date()) {
            throw new AuthenticationError(
                ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
                ERROR_CODES.INVALID_REFRESH_TOKEN,
            );
        }

        if (session.refreshTokenHash !== presentedHash) {
            await revokeAdminSession(session.id, tx);

            await auditService.log(
                {
                    category: 'AUTH',
                    action: 'TOKEN_REFRESH',
                    status: 'FAILURE',
                    actorType: 'ADMIN',
                    actorAdminId: session.adminId,
                    targetType: 'SESSION',
                    targetId: session.id,
                    metadata: {
                        reason: 'TOKEN_REUSE_DETECTED',
                    },
                    requestId: context.requestId ?? null,
                    ipAddress: context.ipAddress ?? null,
                    userAgent: context.userAgent ?? null,
                },
                tx,
            );

            return null;
        }

        const admin = await findAdminById(session.adminId, tx);

        if (!admin || admin.status !== AdminStatus.ACTIVE) {
            await revokeAdminSession(session.id, tx);

            return null;
        }

        if (
            admin.lockedUntil &&
            admin.lockedUntil > new Date()
        ) {
            throw new AuthenticationError(
                ERROR_MESSAGES.ACCOUNT_LOCKED,
                ERROR_CODES.ACCOUNT_LOCKED,
            );
        }

        // Keep the session JTI stable; see auth.service.ts's refresh()
        // for the full rationale (the JWT rotates — createRefreshToken
        // signs a new token with a fresh `iat`, so its hash always
        // changes — but the session's JTI identifying the refresh-token
        // family must not be regenerated, or a replayed old token would
        // just fail to find the session instead of triggering reuse
        // detection by finding it with a stale hash).
        const newRefreshToken = await createRefreshToken({
            sub: session.adminId,
            jti: session.refreshTokenJti,
        });

        await updateAdminSessionToken(
            session.id,
            {
                refreshTokenJti: session.refreshTokenJti,
                refreshTokenHash:
                    hashRefreshToken(newRefreshToken),
                lastUsedAt: new Date(),
            },
            tx,
        );

        const accessToken = await createAdminAccessToken({
            sub: session.adminId,
            sid: session.id,
            role: admin.role,
        });

        await auditService.log(
            {
                category: 'AUTH',
                action: 'TOKEN_REFRESH',
                status: 'SUCCESS',
                actorType: 'ADMIN',
                actorAdminId: session.adminId,
                targetType: 'SESSION',
                targetId: session.id,
                requestId: context.requestId ?? null,
                ipAddress: context.ipAddress ?? null,
                userAgent: context.userAgent ?? null,
            },
            tx,
        );

        return {
            accessToken,
            refreshToken: newRefreshToken,
        };
    });

    if (!result) {
        throw new AuthenticationError(
            ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
            ERROR_CODES.INVALID_REFRESH_TOKEN,
        );
    }

    return result;
};

export const logoutAdmin = async (
    refreshToken?: string,
    accessToken?: string,
    context?: RequestContext,
): Promise<void> => {
    let sessionId: string | null = null;
    let adminId: string | null = null;

    if (refreshToken) {
        try {
            const verified =
                await verifyRefreshToken(refreshToken);

            const jti =
                typeof verified.payload.jti === 'string'
                    ? verified.payload.jti
                    : null;

            adminId =
                typeof verified.payload.sub === 'string'
                    ? verified.payload.sub
                    : null;

            if (jti) {
                const session =
                    await revokeAdminSessionByJti(jti);

                if (session) {
                    sessionId = session.id;
                }
            }
        } catch {
            // Logout must remain idempotent.
        }
    }

    if (!sessionId && accessToken) {
        try {
            const verified = await verifyAccessToken(accessToken);

            sessionId =
                typeof verified.payload.sid === 'string'
                    ? verified.payload.sid
                    : null;

            adminId =
                typeof verified.payload.sub === 'string'
                    ? verified.payload.sub
                    : null;

            if (sessionId) {
                await revokeAdminSession(sessionId);
            }
        } catch {
            // Logout must remain idempotent.
        }
    }

    if (sessionId) {
        await auditService.log({
            category: 'AUTH',
            action: 'ADMIN_LOGOUT',
            status: 'SUCCESS',
            actorType: 'ADMIN',
            actorAdminId: adminId,
            targetType: 'SESSION',
            targetId: sessionId,
            requestId: context?.requestId ?? null,
            ipAddress: context?.ipAddress ?? null,
            userAgent: context?.userAgent ?? null,
        });
    }
};

export const getAdminProfile = async (
    adminId: string,
): Promise<AdminSummary> => {
    const admin = await findAdminById(adminId);

    if (!admin) {
        throw new AuthenticationError(
            ERROR_MESSAGES.UNAUTHORIZED,
            ERROR_CODES.UNAUTHORIZED,
        );
    }

    return sanitizeAdmin(admin);
};
