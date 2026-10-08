import { Router } from 'express';

import {
    validateBody,
    validateParams,
} from '../../middleware/validation.middleware.js';

import {
    createGatewayPaymentController,
    simulateFailureController,
    simulateSuccessController,
} from './payment.controller.js';
import {
    createGatewayPaymentSchema,
    failurePaymentSchema,
    gatewayPaymentIdParamsSchema,
} from './payment.validators.js';

const router = Router();

router.post(
    '/',
    validateBody(createGatewayPaymentSchema),
    createGatewayPaymentController,
);

router.post(
    '/:paymentId/success',
    validateParams(gatewayPaymentIdParamsSchema),
    simulateSuccessController,
);

router.post(
    '/:paymentId/failure',
    validateParams(gatewayPaymentIdParamsSchema),
    validateBody(failurePaymentSchema),
    simulateFailureController,
);

export default router;
