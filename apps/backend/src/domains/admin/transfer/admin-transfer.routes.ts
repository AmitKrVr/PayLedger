import { Router } from 'express';

import { requireAdminAuth } from '../../../middleware/auth.middleware.js';
import { validateParams } from '../../../middleware/validation.middleware.js';

import { reverseTransferController } from './admin-transfer.controller.js';
import { transferIdParamsSchema } from './admin-transfer.validator.js';

const router = Router();

router.post(
    '/:id/reverse',
    requireAdminAuth,
    validateParams(transferIdParamsSchema),
    reverseTransferController,
);

export default router;
