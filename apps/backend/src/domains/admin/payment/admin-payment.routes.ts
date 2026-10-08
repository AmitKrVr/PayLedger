import { Router } from 'express';

import { requireAdminAuth } from '../../../middleware/auth.middleware.js';
import {
    validateParams,
    validateQuery,
} from '../../../middleware/validation.middleware.js';

import {
    getPaymentController,
    listPaymentsController,
} from './admin-payment.controller.js';
import {
    listPaymentsQuerySchema,
    paymentIdParamsSchema,
} from './admin-payment.validator.js';

const router = Router();

router.get(
    '/',
    requireAdminAuth,
    validateQuery(listPaymentsQuerySchema),
    listPaymentsController,
);

router.get(
    '/:id',
    requireAdminAuth,
    validateParams(paymentIdParamsSchema),
    getPaymentController,
);

export default router;
