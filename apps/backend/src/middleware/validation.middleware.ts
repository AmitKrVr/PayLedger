import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export const validateBody = <T>(
    schema: ZodType<T>,
): RequestHandler => {
    return (req, _res, next) => {
        try {
            req.body = schema.parse(req.body ?? {});
            next();
        } catch (error) {
            next(error);
        }
    };
};

export const validateQuery = <T>(
    schema: ZodType<T>,
): RequestHandler => {
    return (req, _res, next) => {
        try {
            req.validatedQuery = schema.parse(req.query);
            next();
        } catch (error) {
            next(error);
        }
    };
};

export const validateParams = <T>(
    schema: ZodType<T>,
): RequestHandler => {
    return (req, _res, next) => {
        try {
            req.validatedParams = schema.parse(req.params);
            next();
        } catch (error) {
            next(error);
        }
    };
};

export const validateHeaders = <T>(
    schema: ZodType<T>,
): RequestHandler => {
    return (req, _res, next) => {
        try {
            req.validatedHeaders = schema.parse(req.headers);
            next();
        } catch (error) {
            next(error);
        }
    };
};