import { Router } from 'express';

import { requireAdminAuth } from '../../../middleware/auth.middleware.js';
import {
    validateParams,
    validateQuery,
} from '../../../middleware/validation.middleware.js';

import {
    getTransferController,
    listTransfersController,
    reverseTransferController,
} from './admin-transfer.controller.js';
import {
    listTransfersQuerySchema,
    transferIdParamsSchema,
} from './admin-transfer.validator.js';

const router = Router();

router.get(
    '/',
    requireAdminAuth,
    validateQuery(listTransfersQuerySchema),
    listTransfersController,
);

router.get(
    '/:id',
    requireAdminAuth,
    validateParams(transferIdParamsSchema),
    getTransferController,
);

router.post(
    '/:id/reverse',
    requireAdminAuth,
    validateParams(transferIdParamsSchema),
    reverseTransferController,
);

export default router;
