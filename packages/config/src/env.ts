import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const envPaths = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
];

const envPath = envPaths.find((path) => existsSync(path));

if (envPath) {
    dotenv.config({ path: envPath });
}

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),

    BACKEND_PORT: z.coerce.number().int().positive().default(5001),

    PAYMENT_GATEWAY_PORT: z.coerce
        .number()
        .int()
        .positive()
        .default(5002),

    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
    DATABASE_IDLE_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(30_000),
    DATABASE_CONNECTION_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(5_000),
    DATABASE_STATEMENT_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(30_000),

    REDIS_URL: z.string().min(1),

    CORS_ORIGINS: z
        .string()
        .min(1)
        .transform((value) =>
            value
                .split(',')
                .map((origin) => origin.trim())
                .filter(Boolean),
        ),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().min(1),
    JWT_AUDIENCE: z.string().min(1),
    JWT_ACCESS_TTL: z.string().min(1).default('15m'),
    JWT_REFRESH_TTL: z.string().min(1).default('30d'),

    AUTH_MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
    AUTH_LOCK_DURATION_MINUTES: z.coerce.number().int().positive().default(15),
    AUTH_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
    RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_REGISTER_MAX: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_REGISTER_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_REFRESH_MAX: z.coerce.number().int().positive().default(20),
    RATE_LIMIT_REFRESH_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),

    // One value per running process; must be unique across concurrently
    // running backend/payment-gateway instances to avoid Snowflake ID
    // collisions.
    SNOWFLAKE_WORKER_ID: z.coerce
        .number()
        .int()
        .min(0)
        .max(1023)
        .default(0),

    PAYMENT_MIN_DEPOSIT_INR: z.coerce.number().int().positive().default(100),
    PAYMENT_MAX_DEPOSIT_INR: z.coerce.number().int().positive().default(25_000),
    PAYMENT_EXPIRY_MINUTES: z.coerce.number().int().positive().default(15),
    PAYMENT_GATEWAY_BASE_URL: z
        .string()
        .min(1)
        .default('http://localhost:5002'),
    PAYMENT_WEBHOOK_SECRET: z.string().min(32),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;