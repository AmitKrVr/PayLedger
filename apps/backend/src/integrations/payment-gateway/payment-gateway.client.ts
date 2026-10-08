import { env } from '@payledger/config';
import { z } from 'zod';

import { ERROR_CODES } from '../../constants/response.constants.js';
import { ERROR_MESSAGES } from '../../constants/message.constants.js';
import { logger } from '../../lib/logger.js';
import { paiseToInr } from '../../lib/money.js';
import { DatabaseError } from '../../middleware/error.middleware.js';

const CREATE_PAYMENT_PATH = '/api/v1/gateway/payments';
const REQUEST_TIMEOUT_MS = 5000;

const gatewayOrderResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        id: z.string().min(1),
        orderId: z.string().min(1),
        paymentId: z.string().min(1),
        amount: z.number(),
        currency: z.literal('INR'),
        status: z.literal('CREATED'),
    }),
});

export type GatewayOrder = z.infer<typeof gatewayOrderResponseSchema>['data'];

export type CreateGatewayPaymentInput = {
    orderId: string;
    amountPaise: bigint;
};

const fail = (orderId: string, reason: string): never => {
    logger.error(
        { orderId, reason },
        'Fake Payment Gateway order creation failed',
    );

    throw new DatabaseError(
        ERROR_MESSAGES.PAYMENT_GATEWAY_ERROR,
        ERROR_CODES.PAYMENT_GATEWAY_ERROR,
    );
};

/**
 * Creates the matching order on the Fake Payment Gateway for an orderId
 * PayLedger already owns. Never trusts the response blindly: the shape is
 * Zod-validated, and the orderId/amount it echoes back are cross-checked
 * against what we actually sent — our own `amountPaise` stays the
 * authoritative financial value either way, never a re-derivation of the
 * gateway's (INR, float) response.
 *
 * `baseUrl` defaults to the real configured gateway; tests may override it
 * to point at a throwaway local server for deterministic, offline runs.
 */
export const createGatewayPayment = async (
    input: CreateGatewayPaymentInput,
    baseUrl: string = env.PAYMENT_GATEWAY_BASE_URL,
): Promise<GatewayOrder> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;

    try {
        response = await fetch(`${baseUrl}${CREATE_PAYMENT_PATH}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: input.orderId,
                amount: Number(input.amountPaise),
                currency: 'INR',
            }),
            signal: controller.signal,
        });
    } catch (error) {
        logger.error(
            { error, orderId: input.orderId },
            'Failed to reach the Fake Payment Gateway',
        );

        return fail(input.orderId, 'unreachable');
    } finally {
        clearTimeout(timeout);
    }

    if (!response.ok) {
        return fail(input.orderId, `http_${response.status}`);
    }

    let json: unknown;

    try {
        json = await response.json();
    } catch {
        return fail(input.orderId, 'unparsable_response');
    }

    const parsed = gatewayOrderResponseSchema.safeParse(json);

    if (!parsed.success) {
        return fail(input.orderId, 'malformed_response');
    }

    const order = parsed.data.data;

    if (order.orderId !== input.orderId) {
        return fail(input.orderId, 'orderId_mismatch');
    }

    const expectedAmountInr = paiseToInr(input.amountPaise);

    if (order.amount !== expectedAmountInr) {
        return fail(input.orderId, 'amount_mismatch');
    }

    return order;
};
