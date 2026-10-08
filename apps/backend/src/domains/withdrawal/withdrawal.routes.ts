import { Router } from 'express';

import { requireUserAuth } from '../../middleware/auth.middleware.js';
import {
    validateBody,
    validateParams,
    validateQuery,
} from '../../middleware/validation.middleware.js';

import {
    createWithdrawalController,
    getWithdrawalController,
    listWithdrawalsController,
} from './withdrawal.controller.js';
import {
    createWithdrawalSchema,
    listWithdrawalsQuerySchema,
    withdrawalIdParamsSchema,
} from './withdrawal.validator.js';

const router = Router();

router.get(
    '/',
    requireUserAuth,
    validateQuery(listWithdrawalsQuerySchema),
    listWithdrawalsController,
);

router.post(
    '/',
    requireUserAuth,
    validateBody(createWithdrawalSchema),
    createWithdrawalController,
);

router.get(
    '/:id',
    requireUserAuth,
    validateParams(withdrawalIdParamsSchema),
    getWithdrawalController,
);

export default router;
