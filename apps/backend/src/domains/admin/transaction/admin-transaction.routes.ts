import { Router } from 'express';

import { requireAdminAuth } from '../../../middleware/auth.middleware.js';
import {
    validateParams,
    validateQuery,
} from '../../../middleware/validation.middleware.js';

import {
    getTransactionController,
    listTransactionsController,
} from './admin-transaction.controller.js';
import {
    listTransactionsQuerySchema,
    transactionIdParamsSchema,
} from './admin-transaction.validator.js';

const router = Router();

router.get(
    '/',
    requireAdminAuth,
    validateQuery(listTransactionsQuerySchema),
    listTransactionsController,
);

router.get(
    '/:id',
    requireAdminAuth,
    validateParams(transactionIdParamsSchema),
    getTransactionController,
);

export default router;
