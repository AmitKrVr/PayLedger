import { Router } from 'express';

import { requireUserAuth } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';

import { createWithdrawalController } from './withdrawal.controller.js';
import { createWithdrawalSchema } from './withdrawal.validator.js';

const router = Router();

router.post(
    '/',
    requireUserAuth,
    validateBody(createWithdrawalSchema),
    createWithdrawalController,
);

export default router;
