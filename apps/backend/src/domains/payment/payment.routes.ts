import { Router } from 'express';

import { requireUserAuth } from '../../middleware/auth.middleware.js';
import {
    validateBody,
    validateParams,
} from '../../middleware/validation.middleware.js';

import {
    createPaymentController,
    getPaymentController,
    paymentWebhookSignatureMiddleware,
    webhookController,
} from './payment.controller.js';
import {
    createPaymentSchema,
    paymentIdParamsSchema,
} from './payment.validator.js';

const router = Router();

// Registered before '/:id' and secured by its own signature check —
// never requireUserAuth — so it can never be shadowed by a param route.
router.post(
    '/webhook',
    paymentWebhookSignatureMiddleware,
    webhookController,
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

export default router;
