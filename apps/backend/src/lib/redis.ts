import { createClient } from 'redis';

import { env } from '@payledger/config';
import { logger } from './logger.js';

export const redis = createClient({
    url: env.REDIS_URL,
});

redis.on('error', (error) => {
    logger.error({ error }, 'Redis client error');
});

// redis.on('connect', () => {
//     logger.info('Redis connected');
// });

redis.on('ready', () => {
    logger.info('Redis ready');
});

redis.on('reconnecting', () => {
    logger.warn('Redis reconnecting');
});

redis.on('end', () => {
    logger.info('Redis connection closed');
});

export const connectRedis = async (): Promise<void> => {
    if (redis.isOpen) {
        return;
    }

    await redis.connect();
};

export const disconnectRedis = async (): Promise<void> => {
    if (!redis.isOpen) {
        return;
    }

    await redis.quit();
};