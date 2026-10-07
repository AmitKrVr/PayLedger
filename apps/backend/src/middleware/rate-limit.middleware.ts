import type { RequestHandler } from 'express';

import { env } from '@payledger/config';

import { incrementRateLimit } from '../lib/redis.js';
import { RateLimitError } from './error.middleware.js';

export const createRateLimit = (options: {
    prefix: string;
    maxRequests: number;
    windowSeconds: number;
    message?: string;
}): RequestHandler => {
    return async (req, _res, next) => {
        try {
            const ip = req.ip || '127.0.0.1';
            const key = `rate_limit:${options.prefix}:${ip}`;

            const count = await incrementRateLimit(key, options.windowSeconds);

            if (count > options.maxRequests) {
                throw new RateLimitError(
                    options.message ?? 'Too many requests. Please try again later.',
                );
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

export const loginRateLimit = createRateLimit({
    prefix: 'auth:login',
    maxRequests: env.RATE_LIMIT_LOGIN_MAX,
    windowSeconds: env.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
});

export const registerRateLimit = createRateLimit({
    prefix: 'auth:register',
    maxRequests: env.RATE_LIMIT_REGISTER_MAX,
    windowSeconds: env.RATE_LIMIT_REGISTER_WINDOW_SECONDS,
});

export const refreshRateLimit = createRateLimit({
    prefix: 'auth:refresh',
    maxRequests: env.RATE_LIMIT_REFRESH_MAX,
    windowSeconds: env.RATE_LIMIT_REFRESH_WINDOW_SECONDS,
});

export const adminLoginRateLimit = createRateLimit({
    prefix: 'admin:login',
    maxRequests: env.RATE_LIMIT_LOGIN_MAX,
    windowSeconds: env.RATE_LIMIT_LOGIN_WINDOW_SECONDS,
});

export const adminRefreshRateLimit = createRateLimit({
    prefix: 'admin:refresh',
    maxRequests: env.RATE_LIMIT_REFRESH_MAX,
    windowSeconds: env.RATE_LIMIT_REFRESH_WINDOW_SECONDS,
});
