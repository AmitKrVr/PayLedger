import type { Response } from 'express';

export type SuccessResponseOptions<T> = {
    data: T;
    message?: string;
    code?: string;
    statusCode?: number;
};

export type PaginationMeta = {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
};

export type PaginatedResponseOptions<T> = {
    data: T[];
    page: number;
    limit: number;
    totalItems: number;
    message?: string;
    code?: string;
    statusCode?: number;
};

export const sendSuccess = <T>(
    res: Response,
    options: SuccessResponseOptions<T>,
) => {
    const {
        data,
        message = 'Operation successful',
        code = 'SUCCESS',
        statusCode = 200,
    } = options;

    return res.status(statusCode).json({
        success: true,
        code,
        message,
        requestId: res.req.requestId,
        data,
    });
};

export const sendPaginated = <T>(
    res: Response,
    options: PaginatedResponseOptions<T>,
) => {
    const {
        data,
        page,
        limit,
        totalItems,
        message = 'Records fetched successfully',
        code = 'SUCCESS',
        statusCode = 200,
    } = options;

    const totalPages = Math.ceil(totalItems / limit);

    const meta: PaginationMeta = {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    };

    return res.status(statusCode).json({
        success: true,
        code,
        message,
        requestId: res.req.requestId,
        data,
        meta,
    });
};