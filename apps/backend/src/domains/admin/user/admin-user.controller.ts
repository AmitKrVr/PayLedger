import type { RequestHandler } from 'express';

import { sendPaginated, sendSuccess } from '../../../lib/http.js';

import { getUser, listUsers } from './admin-user.service.js';
import type { ListUsersQuery, UserIdParams } from './admin-user.validator.js';

export const listUsersController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { page, limit, ...filters } =
            req.validatedQuery as ListUsersQuery;

        const { items, totalItems } = await listUsers({
            page,
            limit,
            ...filters,
        });

        return sendPaginated(res, {
            data: items,
            page,
            limit,
            totalItems,
        });
    } catch (error) {
        next(error);
    }
};

export const getUserController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { id } = req.validatedParams as UserIdParams;

        const user = await getUser(id);

        return sendSuccess(res, {
            data: user,
        });
    } catch (error) {
        next(error);
    }
};
