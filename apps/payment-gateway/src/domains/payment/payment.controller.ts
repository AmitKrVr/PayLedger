import type { RequestHandler } from 'express';

import { sendSuccess } from '../../lib/http.js';

import {
    createGatewayPayment,
    simulateFailure,
    simulateSuccess,
} from './payment.service.js';
import type {
    CreateGatewayPaymentInput,
    FailurePaymentInput,
    GatewayPaymentIdParams,
} from './payment.validators.js';

export const createGatewayPaymentController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const body = req.body as CreateGatewayPaymentInput;

        const payment = await createGatewayPayment(body);

        return sendSuccess(res, {
            statusCode: 201,
            code: 'CREATED',
            data: payment,
        });
    } catch (error) {
        next(error);
    }
};

export const simulateSuccessController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { paymentId } = req.validatedParams as GatewayPaymentIdParams;

        const payment = await simulateSuccess(paymentId);

        return sendSuccess(res, {
            data: payment,
        });
    } catch (error) {
        next(error);
    }
};

export const simulateFailureController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { paymentId } = req.validatedParams as GatewayPaymentIdParams;
        const body = req.body as FailurePaymentInput;

        const payment = await simulateFailure(paymentId, body.reason);

        return sendSuccess(res, {
            data: payment,
        });
    } catch (error) {
        next(error);
    }
};
