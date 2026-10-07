import type { RequestHandler } from 'express';

import { logger } from '../lib/logger.js';

export const requestLoggerMiddleware: RequestHandler = (
    req,
    res,
    next,
) => {
    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
        const durationMs =
            Number(process.hrtime.bigint() - startTime) / 1_000_000;

        logger.info(
            {
                requestId: req.requestId,
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: Number(durationMs.toFixed(2)),
                ip: req.ip,
                userAgent: req.get('user-agent'),
            },
            'HTTP request',
        );
    });

    next();
};