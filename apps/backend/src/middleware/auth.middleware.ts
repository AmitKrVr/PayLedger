import type { JWTPayload } from 'jose';
import type { RequestHandler } from 'express';

import { AdminRole } from '@payledger/database';

import { AuthenticationError } from './error.middleware.js';
import { getAccessTokenCookieName, type AuthRole } from '../lib/auth/cookies.js';
import {
    verifyAccessToken,
    type AdminAccessTokenPayload,
    type UserAccessTokenPayload,
} from '../lib/auth/jwt.js';
import { ERROR_MESSAGES } from '../constants/message.constants.js';
import { ERROR_CODES } from '../constants/response.constants.js';

const isAdminRole = (
    value: unknown,
): value is AdminRole => {
    return (
        typeof value === 'string' &&
        Object.values(AdminRole).includes(
            value as AdminRole,
        )
    );
};

const isUserAccessTokenPayload = (
    payload: JWTPayload,
): payload is JWTPayload & UserAccessTokenPayload => {
    return (
        typeof payload.sub === 'string' &&
        typeof payload.sid === 'string' &&
        payload.role === undefined
    );
};

const isAdminAccessTokenPayload = (
    payload: JWTPayload,
): payload is JWTPayload & AdminAccessTokenPayload => {
    return (
        typeof payload.sub === 'string' &&
        typeof payload.sid === 'string' &&
        isAdminRole(payload.role)
    );
};

const getAccessToken = (
    req: Express.Request,
    role: AuthRole,
): string | null => {
    const token = req.cookies?.[
        getAccessTokenCookieName(role)
    ];

    return typeof token === 'string' ? token : null;
};

export const requireUserAuth: RequestHandler = async (
    req,
    _res,
    next,
) => {
    const token = getAccessToken(req, 'user');

    if (!token) {
        next(
            new AuthenticationError(
                ERROR_MESSAGES.UNAUTHORIZED,
                ERROR_CODES.UNAUTHORIZED,
            ),
        );
        return;
    }

    try {
        const { payload } =
            await verifyAccessToken(token);

        if (!isUserAccessTokenPayload(payload)) {
            next(
                new AuthenticationError(
                    ERROR_MESSAGES.INVALID_TOKEN,
                    ERROR_CODES.INVALID_TOKEN,
                ),
            );
            return;
        }

        req.user = {
            userId: payload.sub,
            sessionId: payload.sid,
        };

        next();
    } catch {
        next(
            new AuthenticationError(
                ERROR_MESSAGES.INVALID_TOKEN,
                ERROR_CODES.INVALID_TOKEN,
            ),
        );
    }
};

export const requireAdminAuth: RequestHandler = async (
    req,
    _res,
    next,
) => {
    const token = getAccessToken(req, 'admin');

    if (!token) {
        next(
            new AuthenticationError(
                ERROR_MESSAGES.UNAUTHORIZED,
                ERROR_CODES.UNAUTHORIZED,
            ),
        );
        return;
    }

    try {
        const { payload } =
            await verifyAccessToken(token);

        if (!isAdminAccessTokenPayload(payload)) {
            next(
                new AuthenticationError(
                    ERROR_MESSAGES.INVALID_TOKEN,
                    ERROR_CODES.INVALID_TOKEN,
                ),
            );
            return;
        }

        req.admin = {
            adminId: payload.sub,
            sessionId: payload.sid,
            role: payload.role,
        };

        next();
    } catch {
        next(
            new AuthenticationError(
                ERROR_MESSAGES.INVALID_TOKEN,
                ERROR_CODES.INVALID_TOKEN,
            ),
        );
    }
};