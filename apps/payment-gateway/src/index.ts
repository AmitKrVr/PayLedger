import { createServer } from 'node:http';

import { env } from '@payledger/config';
import { closeConnection, testConnection } from '@payledger/database';

import app from './app.js';
import { logger } from './lib/logger.js';

const server = createServer(app);

const startServer = async (): Promise<void> => {
    try {
        await testConnection();
        logger.info('PostgreSQL connected');

        server.listen(env.PAYMENT_GATEWAY_PORT, '0.0.0.0', () => {
            logger.info(
                { port: env.PAYMENT_GATEWAY_PORT },
                'Fake Payment Gateway started successfully',
            );
        });
    } catch (error) {
        logger.fatal({ error }, 'Failed to start Fake Payment Gateway');
        process.exit(1);
    }
};

const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Graceful shutdown started');

    server.close(async () => {
        try {
            await closeConnection();

            logger.info('Fake Payment Gateway shutdown completed');
            process.exit(0);
        } catch (error) {
            logger.error({ error }, 'Error during graceful shutdown');
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
