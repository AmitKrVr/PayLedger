import { env } from '@payledger/config';
import type { Response } from 'express';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

export const setAuthCookies = (
    res: Response,
    accessToken: string,
    refreshToken: string,
): void => {
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000,
    });

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
    });
};

export const clearAuthCookies = (
    res: Response,
): void => {
    res.clearCookie(ACCESS_TOKEN_COOKIE, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });

    res.clearCookie(REFRESH_TOKEN_COOKIE, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });
};

export const getAccessTokenCookieName = (): string =>
    ACCESS_TOKEN_COOKIE;

export const getRefreshTokenCookieName = (): string =>
    REFRESH_TOKEN_COOKIE;