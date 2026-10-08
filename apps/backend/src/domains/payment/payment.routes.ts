import { Router } from 'express';

import { requireUserAuth } from '../../middleware/auth.middleware.js';
import {
    validateBody,
    validateParams,
    validateQuery,
} from '../../middleware/validation.middleware.js';

import {
    createPaymentController,
    getPaymentController,
    listPaymentsController,
    paymentWebhookSignatureMiddleware,
    simulatePaymentController,
    webhookController,
} from './payment.controller.js';
import {
    createPaymentSchema,
    listPaymentsQuerySchema,
    paymentIdParamsSchema,
    simulatePaymentSchema,
} from './payment.validator.js';

const router = Router();

// Registered before '/:id' and secured by its own signature check —
// never requireUserAuth — so it can never be shadowed by a param route.
router.post(
    '/webhook',
    paymentWebhookSignatureMiddleware,
    webhookController,
);

router.get(
    '/',
    requireUserAuth,
    validateQuery(listPaymentsQuerySchema),
    listPaymentsController,
);

router.post(
    '/',
    requireUserAuth,
    validateBody(createPaymentSchema),
    createPaymentController,
);

router.get(
    '/:id',
    requireUserAuth,
    validateParams(paymentIdParamsSchema),
    getPaymentController,
);

router.post(
    '/:id/simulate',
    requireUserAuth,
    validateParams(paymentIdParamsSchema),
    validateBody(simulatePaymentSchema),
    simulatePaymentController,
);

export default router;
