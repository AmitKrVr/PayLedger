import type { Response } from 'express';

export type SuccessResponseOptions<T> = {
    data: T;
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
