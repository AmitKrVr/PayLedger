import argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';

export const hashPassword = async (
    password: string,
): Promise<string> => {
    return argon2.hash(password, {
        type: argon2.argon2id,
    });
};

export const verifyPassword = async (
    passwordHash: string,
    password: string,
): Promise<boolean> => {
    return argon2.verify(passwordHash, password);
};

export const hashRefreshToken = (
    token: string,
): string => {
    return createHash('sha256')
        .update(token)
        .digest('hex');
};

/**
 * Lazily-computed Argon2id hash of a password nobody will ever enter.
 * Shared by every login flow (user, admin, ...): run verifyPassword's
 * full cost even when no account was found, so "unknown identifier" and
 * "wrong password" take the same amount of time and accounts can't be
 * enumerated via response timing.
 */
let dummyPasswordHashPromise: Promise<string> | null = null;

export const getDummyPasswordHash = (): Promise<string> => {
    dummyPasswordHashPromise ??= hashPassword(randomUUID());

    return dummyPasswordHashPromise;
};