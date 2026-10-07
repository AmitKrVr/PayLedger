import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),

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
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;