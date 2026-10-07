import argon2 from 'argon2';
import { createHash } from 'node:crypto';

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