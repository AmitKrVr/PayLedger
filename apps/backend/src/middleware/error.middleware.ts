import type {
    ErrorRequestHandler,
    RequestHandler,
    Response,
} from 'express';
import { ZodError } from 'zod';

import { logger } from '../lib/logger.js';
import {
    formatZodErrors,
    type FieldValidationError,
} from '../lib/zod-error.js';

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(
        statusCode: number,
        message: string,
        code: string,
        isOperational = true,
    ) {
        super(message);

        this.statusCode = statusCode;
        this.message = message;
        this.code = code;
        this.isOperational = isOperational;
        this.name = 'AppError';

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }
}

export class ValidationError extends AppError {
    constructor(message: string, code = 'VALIDATION_ERROR') {
        super(422, message, code);
        this.name = 'ValidationError';
    }
}

export class BadRequestError extends AppError {
    constructor(message = 'Bad request', code = 'BAD_REQUEST') {
        super(400, message, code);
        this.name = 'BadRequestError';
    }
}

export class AuthenticationError extends AppError {
    constructor(
        message = 'Please sign in to continue',
        code = 'AUTHENTICATION_ERROR',
    ) {
        super(401, message, code);
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends AppError {
    constructor(
        message = 'You are not allowed to perform this action',
        code = 'AUTHORIZATION_ERROR',
    ) {
        super(403, message, code);
        this.name = 'AuthorizationError';
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Resource not found', code = 'NOT_FOUND') {
        super(404, message, code);
        this.name = 'NotFoundError';
    }
}

export class ConflictError extends AppError {
    constructor(message: string, code = 'CONFLICT') {
        super(409, message, code);
        this.name = 'ConflictError';
    }
}

export class RateLimitError extends AppError {
    constructor(
        message = 'Too many requests. Please try again later.',
        code = 'RATE_LIMIT_EXCEEDED',
    ) {
        super(429, message, code);
        this.name = 'RateLimitError';
    }
}

export class DatabaseError extends AppError {
    constructor(message = 'Database error', code = 'DATABASE_ERROR') {
        super(500, message, code, false);
        this.name = 'DatabaseError';
    }
}

export class BusinessRuleError extends AppError {
    constructor(
        message: string,
        code = 'BUSINESS_RULE_VIOLATION',
    ) {
        super(422, message, code);
        this.name = 'BusinessRuleError';
    }
}

type ErrorResponseOptions = {
    statusCode: number;
    code: string;
    message: string;
    requestId: string;
    errors?: FieldValidationError[];
    debug?: {
        name: string;
        message: string;
        stack?: string;
    };
};

const sendErrorResponse = (
    res: Response,
    options: ErrorResponseOptions,
) => {
    const {
        statusCode,
        code,
        message,
        requestId,
        errors,
        debug,
    } = options;

    return res.status(statusCode).json({
        success: false,
        code,
        message,
        ...(errors ? { errors } : {}),
        requestId,
        ...(debug ? { debug } : {}),
    });
};

export const notFoundHandler: RequestHandler = (
    req,
    _res,
    next,
) => {
    next(
        new NotFoundError(
            `Route ${req.method} ${req.originalUrl} not found`,
        ),
    );
};

export const errorHandler: ErrorRequestHandler = (
    err,
    req,
    res,
    _next,
) => {
    const requestId = req.requestId;

    if (err instanceof ZodError) {
        logger.warn(
            {
                err,
                requestId,
                method: req.method,
                path: req.originalUrl,
            },
            'Request validation failed',
        );

        sendErrorResponse(res, {
            statusCode: 422,
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors: formatZodErrors(err),
            requestId,
        });

        return;
    }

    if (err instanceof AppError) {
        logger[err.isOperational ? 'warn' : 'error'](
            {
                err,
                code: err.code,
                statusCode: err.statusCode,
                requestId,
                method: req.method,
                path: req.originalUrl,
            },
            err.message,
        );

        sendErrorResponse(res, {
            statusCode: err.statusCode,
            code: err.code,
            message: err.message,
            requestId,
        });

        return;
    }

    const pgCode =
        (err as { cause?: { code?: string } })?.cause?.code ||
        (err as { code?: string })?.code;

    const pgDetail =
        (err as { cause?: { detail?: string } })?.cause?.detail ||
        (err as { detail?: string })?.detail ||
        '';

    if (pgCode === '23505') {
        logger.warn(
            {
                err,
                requestId,
                method: req.method,
                path: req.originalUrl,
            },
            'Unique constraint violation',
        );

        sendErrorResponse(res, {
            statusCode: 409,
            code: 'CONFLICT',
            message:
                'This record already exists or conflicts with an existing entry',
            requestId,
        });

        return;
    }

    if (pgCode === '23503') {
        logger.warn(
            {
                err,
                requestId,
                method: req.method,
                path: req.originalUrl,
            },
            'Foreign key constraint violation',
        );

        if (pgDetail.includes('is not present in table')) {
            sendErrorResponse(res, {
                statusCode: 404,
                code: 'NOT_FOUND',
                message: 'A referenced resource does not exist',
                requestId,
            });

            return;
        }

        sendErrorResponse(res, {
            statusCode: 422,
            code: 'VALIDATION_ERROR',
            message:
                'This operation violates a relationship constraint',
            requestId,
        });

        return;
    }

    logger.error(
        {
            err,
            requestId,
            method: req.method,
            path: req.originalUrl,
        },
        'Unhandled application error',
    );

    sendErrorResponse(res, {
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        requestId,
        ...(process.env.NODE_ENV === 'development'
            ? {
                debug: {
                    name: err instanceof Error ? err.name : 'UnknownError',
                    message:
                        err instanceof Error
                            ? err.message
                            : String(err),
                    stack:
                        err instanceof Error
                            ? err.stack
                            : undefined,
                },
            }
            : {}),
    });
};