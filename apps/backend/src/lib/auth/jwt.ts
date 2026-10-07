import { SignJWT, jwtVerify } from 'jose';

import { env } from '@payledger/config';
import type { AdminRole } from '@payledger/database';

const accessSecret = new TextEncoder().encode(
    env.JWT_ACCESS_SECRET,
);

const refreshSecret = new TextEncoder().encode(
    env.JWT_REFRESH_SECRET,
);

export type UserAccessTokenPayload = {
    sub: string;
    sid: string;
};

export type AdminAccessTokenPayload = {
    sub: string;
    sid: string;
    role: AdminRole;
};

export type RefreshTokenPayload = {
    sub: string;
    jti: string;
};

export const createUserAccessToken = async (
    payload: UserAccessTokenPayload,
): Promise<string> => {
    return new SignJWT({
        sid: payload.sid,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(payload.sub)
        .setIssuer(env.JWT_ISSUER)
        .setAudience(env.JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(env.JWT_ACCESS_TTL)
        .sign(accessSecret);
};

export const createAdminAccessToken = async (
    payload: AdminAccessTokenPayload,
): Promise<string> => {
    return new SignJWT({
        sid: payload.sid,
        role: payload.role,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(payload.sub)
        .setIssuer(env.JWT_ISSUER)
        .setAudience(env.JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(env.JWT_ACCESS_TTL)
        .sign(accessSecret);
};

export const createRefreshToken = async (
    payload: RefreshTokenPayload,
): Promise<string> => {
    return new SignJWT()
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(payload.sub)
        .setJti(payload.jti)
        .setIssuer(env.JWT_ISSUER)
        .setAudience(env.JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(env.JWT_REFRESH_TTL)
        .sign(refreshSecret);
};

export const verifyAccessToken = async (
    token: string,
) => {
    return jwtVerify(token, accessSecret, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
    });
};

export const verifyRefreshToken = async (
    token: string,
) => {
    return jwtVerify(token, refreshSecret, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
    });
};