import { createHmac, timingSafeEqual } from 'node:crypto';

import type { RequestHandler } from 'express';

import { env } from '@payledger/config';

import { SUCCESS_CODES } from '../../constants/response.constants.js';
import { ERROR_CODES } from '../../constants/response.constants.js';
import { ERROR_MESSAGES } from '../../constants/message.constants.js';
import { sendSuccess } from '../../lib/http.js';
import { AuthenticationError } from '../../middleware/error.middleware.js';

import {
    createPayment,
    getPayment,
    processPaymentWebhook,
} from './payment.service.js';
import type {
    CreatePaymentInput,
    PaymentIdParams,
} from './payment.validator.js';

// Matches the Fake Payment Gateway's webhook client exactly.
const WEBHOOK_SIGNATURE_HEADER = 'x-payment-gateway-signature';

/**
 * Pure signature check, exported so it can be unit-tested directly
 * without going through Express. The signature must be computed over the
 * exact raw request bytes (captured by app.ts's express.json `verify`
 * hook) — never over a re-serialized copy of the parsed body, which could
 * legitimately differ byte-for-byte from what the gateway actually signed.
 */
export const verifyWebhookSignature = (
    rawBody: Buffer,
    signatureHeader: string | undefined,
): boolean => {
    if (!signatureHeader) {
        return false;
    }

    const expectedSignature = createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

    const providedBuffer = Buffer.from(signatureHeader, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    return (
        providedBuffer.length === expectedBuffer.length &&
        timingSafeEqual(providedBuffer, expectedBuffer)
    );
};

export const paymentWebhookSignatureMiddleware: RequestHandler = (
    req,
    _res,
    next,
) => {
    try {
        const signatureHeader = req.get(WEBHOOK_SIGNATURE_HEADER);

        if (
            !req.rawBody ||
            !verifyWebhookSignature(req.rawBody, signatureHeader)
        ) {
            throw new AuthenticationError(
                ERROR_MESSAGES.INVALID_WEBHOOK_SIGNATURE,
                ERROR_CODES.INVALID_WEBHOOK_SIGNATURE,
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};

export const createPaymentController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const body = req.body as CreatePaymentInput;
        const idempotencyKey = req.get('idempotency-key');

        const payment = await createPayment(
            req.user!.userId,
            body,
            idempotencyKey,
        );

        return sendSuccess(res, {
            statusCode: 201,
            code: SUCCESS_CODES.CREATED,
            data: payment,
        });
    } catch (error) {
        next(error);
    }
};

export const getPaymentController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        const { id } = req.validatedParams as PaymentIdParams;

        const payment = await getPayment(id, req.user!.userId);

        return sendSuccess(res, {
            data: payment,
        });
    } catch (error) {
        next(error);
    }
};

export const webhookController: RequestHandler = async (
    req,
    res,
    next,
) => {
    try {
        await processPaymentWebhook(req.body);

        return sendSuccess(res, {
            data: null,
        });
    } catch (error) {
        next(error);
    }
};
