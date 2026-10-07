import type { JWTPayload } from 'jose';
import type { RequestHandler } from 'express';

import {
    AdminRole,
    type AdminRole as AdminRoleType,
} from '@payledger/database';

import { AuthenticationError } from './error.middleware.js';
import { getAccessTokenCookieName } from '../lib/auth/cookies.js';
import { verifyAccessToken } from '../lib/auth/jwt.js';

type UserAccessTokenClaims = {
    sub: string;
    sid: string;
};

type AdminAccessTokenClaims = {
    sub: string;
    sid: string;
    role: AdminRoleType;
};

const isAdminRole = (
    value: unknown,
): value is AdminRoleType => {
    return (
        typeof value === 'string' &&
        Object.values(AdminRole).includes(
            value as AdminRoleType,
        )
    );
};

const isUserAccessTokenPayload = (
    payload: JWTPayload,
): payload is JWTPayload & UserAccessTokenClaims => {
    return (
        typeof payload.sub === 'string' &&
        typeof payload.sid === 'string' &&
        payload.role === undefined
    );
};

const isAdminAccessTokenPayload = (
    payload: JWTPayload,
): payload is JWTPayload & AdminAccessTokenClaims => {
    return (
        typeof payload.sub === 'string' &&
        typeof payload.sid === 'string' &&
        isAdminRole(payload.role)
    );
};

const getAccessToken = (
    req: Express.Request,
): string | null => {
    const token = req.cookies?.[getAccessTokenCookieName()];

    return typeof token === 'string' ? token : null;
};

export const requireUserAuth: RequestHandler = async (
    req,
    _res,
    next,
) => {
    const token = getAccessToken(req);

    if (!token) {
        next(
            new AuthenticationError(
                'Authentication token is required',
                'AUTHENTICATION_REQUIRED',
            ),
        );
        return;
    }

    try {
        const { payload } = await verifyAccessToken(token);

        if (!isUserAccessTokenPayload(payload)) {
            next(
                new AuthenticationError(
                    'Invalid access token',
                    'INVALID_TOKEN',
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
                'Invalid or expired access token',
                'INVALID_TOKEN',
            ),
        );
    }
};

export const requireAdminAuth: RequestHandler = async (
    req,
    _res,
    next,
) => {
    const token = getAccessToken(req);

    if (!token) {
        next(
            new AuthenticationError(
                'Authentication token is required',
                'AUTHENTICATION_REQUIRED',
            ),
        );
        return;
    }

    try {
        const { payload } = await verifyAccessToken(token);

        if (!isAdminAccessTokenPayload(payload)) {
            next(
                new AuthenticationError(
                    'Invalid admin access token',
                    'INVALID_TOKEN',
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
                'Invalid or expired access token',
                'INVALID_TOKEN',
            ),
        );
    }
};