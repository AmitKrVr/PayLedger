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
};

const sendErrorResponse = (
    res: Response,
    options: ErrorResponseOptions,
) => {
    const { statusCode, code, message, requestId, errors } = options;

    return res.status(statusCode).json({
        success: false,
        code,
        message,
        ...(errors ? { errors } : {}),
        requestId,
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
    });
};
