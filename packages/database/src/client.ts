import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { env } from '@payledger/config';

import * as schema from './schema/index.js';

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    min: env.DATABASE_POOL_MIN,
    idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
    statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
    ssl: env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
});

pool.on('error', (error) => {
    console.error('Unexpected database pool error', error);
});

export const db = drizzle(pool, { schema });

export { pool };

export type Database = typeof db;

export type Transaction =
    Parameters<Parameters<typeof db.transaction>[0]>[0];

export type DatabaseOrTransaction = Database | Transaction;

export async function testConnection(): Promise<void> {
    await pool.query('SELECT 1');
}

export async function closeConnection(): Promise<void> {
    await pool.end();
}