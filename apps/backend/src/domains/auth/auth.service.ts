import { randomUUID } from 'node:crypto';

import { env } from '@payledger/config';
import {
    db,
    UserStatus,
    type DatabaseOrTransaction,
    type users,
} from '@payledger/database';

import { ERROR_CODES } from '../../constants/response.constants.js';
import { ERROR_MESSAGES } from '../../constants/message.constants.js';
import {
    AuthenticationError,
    ConflictError,
} from '../../middleware/error.middleware.js';
import {
    getDummyPasswordHash,
    hashPassword,
    hashRefreshToken,
    verifyPassword,
} from '../../lib/auth/auth.js';

import {
    createRefreshToken,
    createUserAccessToken,
    verifyAccessToken,
    verifyRefreshToken,
} from '../../lib/auth/jwt.js';

import { auditService } from '../audit/audit.service.js';
import {
    createSession,
    createUser,
    createWallet,
    findSessionByJti,
    findUserByEmail,
    findUserById,
    findUserByMobile,
    findUserByMobileForUpdate,
    revokeSession,
    revokeSessionByJti,
    updateSessionToken,
    updateUserFailedLogin,
    updateUserLoginSuccess,
} from './auth.repository.js';
import type {
    AuthResult,
    AuthUser,
    RequestContext,
} from './auth.types.js';
import type {
    LoginInput,
    RegisterInput,
} from './auth.validator.js';

const sanitizeUser = (
    user: typeof users.$inferSelect,
): AuthUser => ({
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt,
});

const getSessionExpiry = (): Date => {
    return new Date(
        Date.now() +
        env.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
};

const logLoginFailure = (
    tx: DatabaseOrTransaction,
    context: RequestContext,
    userId: string | null,
    reason: string,
    extra?: Record<string, unknown>,
): Promise<void> =>
    auditService.log(
        {
            category: 'AUTH',
            action: 'USER_LOGIN',
            status: 'FAILURE',
            actorType: userId ? 'USER' : 'SYSTEM',
            actorUserId: userId,
            targetType: 'USER',
            targetId: userId,
            metadata: { reason, ...extra },
            requestId: context.requestId ?? null,
            ipAddress: context.ipAddress ?? null,
            userAgent: context.userAgent ?? null,
        },
        tx,
    );

export const register = async (
    input: RegisterInput,
    context: RequestContext,
): Promise<AuthResult> => {
    const existingMobile = await findUserByMobile(input.mobile);

    if (existingMobile) {
        throw new ConflictError(
            'A user with this mobile number already exists',
        );
    }

    if (input.email) {
        const existingEmail = await findUserByEmail(input.email);

        if (existingEmail) {
            throw new ConflictError(
                'A user with this email already exists',
            );
        }
    }

    const passwordHash = await hashPassword(input.password);

    return db.transaction(async (tx) => {
        const user = await createUser(
            {
                name: input.name,
                mobile: input.mobile,
                email: input.email ?? null,
                passwordHash,
                status: UserStatus.ACTIVE,
            },
            tx,
        );

        await createWallet(
            {
                userId: user.id,
            },
            tx,
        );

        const refreshTokenJti = randomUUID();

        const refreshToken = await createRefreshToken({
            sub: user.id,
            jti: refreshTokenJti,
        });

        const session = await createSession(
            {
                userId: user.id,
                refreshTokenJti,
                refreshTokenHash: hashRefreshToken(refreshToken),
                expiresAt: getSessionExpiry(),
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                deviceName: context.deviceName,
            },
            tx,
        );

        const accessToken = await createUserAccessToken({
            sub: user.id,
            sid: session.id,
        });

        await auditService.log(
            {
                category: 'AUTH',
                action: 'USER_REGISTER',
                status: 'SUCCESS',
                actorType: 'USER',
                actorUserId: user.id,
                targetType: 'USER',
                targetId: user.id,
                requestId: context.requestId ?? null,
                ipAddress: context.ipAddress ?? null,
                userAgent: context.userAgent ?? null,
            },
            tx,
        );

        return {
            user: sanitizeUser(user),
            accessToken,
            refreshToken,
        };
    });
};

export const login = async (
    input: LoginInput,
    context: RequestContext,
): Promise<AuthResult> => {
    return db.transaction(async (tx) => {
        const lockedUser = await findUserByMobileForUpdate(
            input.mobile,
            tx,
        );

        // Always pay the Argon2 cost, even for an unknown mobile number,
        // so "no such account" and "wrong password" take the same time.
        const passwordValid = await verifyPassword(
            lockedUser
                ? lockedUser.passwordHash
                : await getDummyPasswordHash(),
            input.password,
        );

        if (!lockedUser) {
            await logLoginFailure(
                tx,
                context,
                null,
                'INVALID_CREDENTIALS',
            );

            throw new AuthenticationError(
                ERROR_MESSAGES.INVALID_CREDENTIALS,
                ERROR_CODES.INVALID_CREDENTIALS,
            );
        }

        if (lockedUser.status === UserStatus.BLOCKED) {
            await logLoginFailure(
                tx,
                context,
                lockedUser.id,
                'ACCOUNT_BLOCKED',
            );

            throw new AuthenticationError(
                ERROR_MESSAGES.INVALID_CREDENTIALS,
                ERROR_CODES.INVALID_CREDENTIALS,
            );
        }

        const now = new Date();
        const lockExpired =
            lockedUser.lockedUntil !== null &&
            lockedUser.lockedUntil <= now;

        // An account that's still locked is rejected outright, without
        // touching the failed-attempt counter. Letting failed attempts
        // during an active lock extend `lockedUntil` would let an
        // attacker who doesn't know the password keep the real owner
        // locked out indefinitely.
        if (lockedUser.lockedUntil !== null && !lockExpired) {
            await logLoginFailure(
                tx,
                context,
                lockedUser.id,
                'ACCOUNT_LOCKED',
            );

            throw new AuthenticationError(
                ERROR_MESSAGES.ACCOUNT_LOCKED,
                ERROR_CODES.ACCOUNT_LOCKED,
            );
        }

        if (!passwordValid) {
            const newFailed =
                (lockExpired ? 0 : lockedUser.failedLoginAttempts) +
                1;

            if (newFailed >= env.AUTH_MAX_FAILED_LOGIN_ATTEMPTS) {
                const lockedUntil = new Date(
                    Date.now() +
                    env.AUTH_LOCK_DURATION_MINUTES * 60 * 1000,
                );

                await updateUserFailedLogin(
                    lockedUser.id,
                    0,
                    lockedUntil,
                    tx,
                );

                await logLoginFailure(
                    tx,
                    context,
                    lockedUser.id,
                    'ACCOUNT_LOCKED',
                    { attempts: newFailed },
                );

                throw new AuthenticationError(
                    ERROR_MESSAGES.ACCOUNT_LOCKED,
                    ERROR_CODES.ACCOUNT_LOCKED,
                );
            }

            await updateUserFailedLogin(
                lockedUser.id,
                newFailed,
                null,
                tx,
            );

            await logLoginFailure(
                tx,
                context,
                lockedUser.id,
                'INVALID_CREDENTIALS',
                { attempts: newFailed },
            );

            throw new AuthenticationError(
                ERROR_MESSAGES.INVALID_CREDENTIALS,
                ERROR_CODES.INVALID_CREDENTIALS,
            );
        }

        const updatedUser = await updateUserLoginSuccess(
            lockedUser.id,
            tx,
        );

        if (!updatedUser) {
            throw new Error('Failed to update login state');
        }

        const refreshTokenJti = randomUUID();

        const refreshToken = await createRefreshToken({
            sub: lockedUser.id,
            jti: refreshTokenJti,
        });

        const session = await createSession(
            {
                userId: lockedUser.id,
                refreshTokenJti,
                refreshTokenHash: hashRefreshToken(refreshToken),
                expiresAt: getSessionExpiry(),
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                deviceName: context.deviceName,
            },
            tx,
        );

        const accessToken = await createUserAccessToken({
            sub: lockedUser.id,
            sid: session.id,
        });

        await auditService.log(
            {
                category: 'AUTH',
                action: 'USER_LOGIN',
                status: 'SUCCESS',
                actorType: 'USER',
                actorUserId: lockedUser.id,
                targetType: 'USER',
                targetId: lockedUser.id,
                requestId: context.requestId ?? null,
                ipAddress: context.ipAddress ?? null,
                userAgent: context.userAgent ?? null,
            },
            tx,
        );

        return {
            user: sanitizeUser(updatedUser),
            accessToken,
            refreshToken,
        };
    });
};

export const refresh = async (
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
        const session = await findSessionByJti(
            payload.jti!,
            tx,
            true,
        );

        if (!session || session.userId !== payload.sub) {
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
            await revokeSession(session.id, tx);

            await auditService.log(
                {
                    category: 'AUTH',
                    action: 'TOKEN_REFRESH',
                    status: 'FAILURE',
                    actorType: 'USER',
                    actorUserId: session.userId,
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

        const user = await findUserById(
            session.userId,
            tx,
        );

        if (!user || user.status === UserStatus.BLOCKED) {
            await revokeSession(session.id, tx);

            return null;
        }

        if (
            user.lockedUntil &&
            user.lockedUntil > new Date()
        ) {
            throw new AuthenticationError(
                ERROR_MESSAGES.ACCOUNT_LOCKED,
                ERROR_CODES.ACCOUNT_LOCKED,
            );
        }

        /*
         * Keep the session JTI stable.
         *
         * The JWT itself rotates (createRefreshToken signs a new token
         * with a fresh `iat`, so its hash always changes), but the
         * session's JTI identifies the refresh-token family and must
         * NOT be regenerated here. Otherwise a replayed old token would
         * simply fail to find the session (JTI no longer matches
         * anything) instead of finding it with a stale hash — which is
         * what actually triggers reuse detection and revokes the
         * session below.
         */
        const newRefreshToken = await createRefreshToken({
            sub: session.userId,
            jti: session.refreshTokenJti,
        });

        await updateSessionToken(
            session.id,
            {
                refreshTokenJti: session.refreshTokenJti,
                refreshTokenHash:
                    hashRefreshToken(newRefreshToken),
                lastUsedAt: new Date(),
            },
            tx,
        );

        const accessToken = await createUserAccessToken({
            sub: session.userId,
            sid: session.id,
        });

        await auditService.log(
            {
                category: 'AUTH',
                action: 'TOKEN_REFRESH',
                status: 'SUCCESS',
                actorType: 'USER',
                actorUserId: session.userId,
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

export const logout = async (
    refreshToken?: string,
    accessToken?: string,
    context?: RequestContext,
): Promise<void> => {
    let sessionId: string | null = null;
    let userId: string | null = null;

    if (refreshToken) {
        try {
            const verified =
                await verifyRefreshToken(refreshToken);

            const jti =
                typeof verified.payload.jti === 'string'
                    ? verified.payload.jti
                    : null;

            userId =
                typeof verified.payload.sub === 'string'
                    ? verified.payload.sub
                    : null;

            if (jti) {
                const session =
                    await revokeSessionByJti(jti);

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

            userId =
                typeof verified.payload.sub === 'string'
                    ? verified.payload.sub
                    : null;

            if (sessionId) {
                await revokeSession(sessionId);
            }
        } catch {
            // Logout must remain idempotent.
        }
    }

    if (sessionId) {
        await auditService.log({
            category: 'AUTH',
            action: 'USER_LOGOUT',
            status: 'SUCCESS',
            actorType: 'USER',
            actorUserId: userId,
            targetType: 'SESSION',
            targetId: sessionId,
            requestId: context?.requestId ?? null,
            ipAddress: context?.ipAddress ?? null,
            userAgent: context?.userAgent ?? null,
        });
    }
};

export const getProfile = async (userId: string): Promise<AuthUser> => {
    const user = await findUserById(userId);

    if (!user) {
        throw new AuthenticationError(
            ERROR_MESSAGES.UNAUTHORIZED,
            ERROR_CODES.UNAUTHORIZED,
        );
    }

    return sanitizeUser(user);
};