import { Router } from 'express';

import { requireUserAuth } from '../../middleware/auth.middleware.js';
import {
    validateParams,
    validateQuery,
} from '../../middleware/validation.middleware.js';

import {
    getTransactionController,
    listTransactionsController,
} from './transaction.controller.js';
import {
    listTransactionsQuerySchema,
    transactionIdParamsSchema,
} from './transaction.validators.js';

const router = Router();

router.get(
    '/',
    requireUserAuth,
    validateQuery(listTransactionsQuerySchema),
    listTransactionsController,
);

router.get(
    '/:id',
    requireUserAuth,
    validateParams(transactionIdParamsSchema),
    getTransactionController,
);

export default router;
