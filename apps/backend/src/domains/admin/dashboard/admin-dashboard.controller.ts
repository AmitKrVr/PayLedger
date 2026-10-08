import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../lib/http.js';

import { getDashboard } from './admin-dashboard.service.js';

export const getDashboardController: RequestHandler = async (
    _req,
    res,
    next,
) => {
    try {
        const dashboard = await getDashboard();

        return sendSuccess(res, {
            data: dashboard,
        });
    } catch (error) {
        next(error);
    }
};
