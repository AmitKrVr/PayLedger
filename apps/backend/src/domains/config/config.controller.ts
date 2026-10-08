import type { RequestHandler } from 'express';

import { sendSuccess } from '../../lib/http.js';

import { getLimits } from './config.service.js';

export const getLimitsController: RequestHandler = (_req, res) => {
    return sendSuccess(res, {
        data: getLimits(),
    });
};
