import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

declare global {
    namespace Express {
        interface Request {
            requestId: string;
        }
    }
}

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
    const requestId = randomUUID();

    req.headers['x-request-id'] = requestId;
    req.requestId = requestId;

    res.setHeader('X-Request-ID', requestId);

    next();
};