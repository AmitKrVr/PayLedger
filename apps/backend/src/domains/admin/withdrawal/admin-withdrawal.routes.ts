import { Router } from 'express';

import { requireAdminAuth } from '../../../middleware/auth.middleware.js';
import {
    validateBody,
    validateParams,
    validateQuery,
} from '../../../middleware/validation.middleware.js';

import {
    approveWithdrawalController,
    getWithdrawalController,
    listWithdrawalsController,
    rejectWithdrawalController,
} from './admin-withdrawal.controller.js';
import {
    listWithdrawalsQuerySchema,
    rejectWithdrawalSchema,
    withdrawalIdParamsSchema,
} from './admin-withdrawal.validator.js';

const router = Router();

router.get(
    '/',
    requireAdminAuth,
    validateQuery(listWithdrawalsQuerySchema),
    listWithdrawalsController,
);

router.get(
    '/:id',
    requireAdminAuth,
    validateParams(withdrawalIdParamsSchema),
    getWithdrawalController,
);

router.post(
    '/:id/approve',
    requireAdminAuth,
    validateParams(withdrawalIdParamsSchema),
    approveWithdrawalController,
);

router.post(
    '/:id/reject',
    requireAdminAuth,
    validateParams(withdrawalIdParamsSchema),
    validateBody(rejectWithdrawalSchema),
    rejectWithdrawalController,
);

export default router;
