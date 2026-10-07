import { createServer } from 'node:http';
import os from 'node:os';

import app from './app.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';
import { logger } from './lib/logger.js';
import {
    closeConnection,
    testConnection,
} from '@payledger/database';
import { env } from '@payledger/config';

const server = createServer(app);

const getLocalIpAddresses = (): string[] => {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];

    for (const entries of Object.values(interfaces)) {
        if (!entries) continue;

        for (const entry of entries) {
            if (entry.family === 'IPv4' && !entry.internal) {
                addresses.push(entry.address);
            }
        }
    }

    return addresses;
};

const startServer = async (): Promise<void> => {
    try {
        await testConnection();
        logger.info('PostgreSQL connected');

        await connectRedis();
        logger.info('Redis connected');

        server.listen(env.BACKEND_PORT, '0.0.0.0', () => {
            const localIpAddresses = getLocalIpAddresses();

            logger.info(
                {
                    host: '0.0.0.0',
                    port: env.BACKEND_PORT,
                    environment: env.NODE_ENV,
                    localIpAddresses,
                    localUrls: localIpAddresses.map(
                        (ip) => `http://${ip}:${env.BACKEND_PORT}`,
                    ),
                },
                'PayLedger API started successfully',
            );
        });
    } catch (error) {
        logger.fatal({ error }, 'Failed to start PayLedger API');
        process.exit(1);
    }
};

const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Graceful shutdown started');

    server.close(async () => {
        try {
            await disconnectRedis();
            await closeConnection();

            logger.info('PayLedger API shutdown completed');
            process.exit(0);
        } catch (error) {
            logger.error(
                { error },
                'Error during graceful shutdown',
            );
            process.exit(1);
        }
    });
};

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception');
    process.exit(1);
});

void startServer();