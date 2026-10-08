import { env } from '@payledger/config';
import type { Response } from 'express';

const COOKIE_NAMES = {
    user: {
        ACCESS_TOKEN: 'access_token',
        REFRESH_TOKEN: 'refresh_token',
    },
    admin: {
        ACCESS_TOKEN: 'admin_access_token',
        REFRESH_TOKEN: 'admin_refresh_token',
    },
} as const;

export type AuthRole = keyof typeof COOKIE_NAMES;

const DURATION_UNIT_MS: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Parses the simple "<number><unit>" duration strings used by
 * JWT_ACCESS_TTL / JWT_REFRESH_TTL (e.g. "15m", "30d") into milliseconds,
 * so cookie maxAge always matches the actual token lifetime instead of
 * duplicating it as separate hardcoded numbers.
 */
const parseDurationToMs = (duration: string): number => {
    const match = /^(\d+)\s*([smhdw])$/i.exec(duration.trim());

    if (!match) {
        throw new Error(
            `Invalid duration format: "${duration}"`,
        );
    }

    const [, amount, unit] = match;

    return Number(amount) * DURATION_UNIT_MS[unit!.toLowerCase()]!;
};

const ACCESS_TOKEN_MAX_AGE_MS = parseDurationToMs(
    env.JWT_ACCESS_TTL,
);

const REFRESH_TOKEN_MAX_AGE_MS = parseDurationToMs(
    env.JWT_REFRESH_TTL,
);

export const setAuthCookies = (
    res: Response,
    role: AuthRole,
    accessToken: string,
    refreshToken: string,
): void => {
    res.cookie(COOKIE_NAMES[role].ACCESS_TOKEN, accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: env.COOKIE_DOMAIN,
        path: '/',
        maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    });

    res.cookie(COOKIE_NAMES[role].REFRESH_TOKEN, refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: env.COOKIE_DOMAIN,
        path: '/',
        maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });
};

export const clearAuthCookies = (
    res: Response,
    role: AuthRole,
): void => {
    res.clearCookie(COOKIE_NAMES[role].ACCESS_TOKEN, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: env.COOKIE_DOMAIN,
        path: '/',
    });

    res.clearCookie(COOKIE_NAMES[role].REFRESH_TOKEN, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: env.COOKIE_DOMAIN,
        path: '/',
    });
};

export const getAccessTokenCookieName = (role: AuthRole): string =>
    COOKIE_NAMES[role].ACCESS_TOKEN;

export const getRefreshTokenCookieName = (role: AuthRole): string =>
    COOKIE_NAMES[role].REFRESH_TOKEN;