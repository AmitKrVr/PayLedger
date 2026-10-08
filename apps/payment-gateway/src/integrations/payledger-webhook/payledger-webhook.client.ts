import { createHmac } from 'node:crypto';

import { env } from '@payledger/config';

import { logger } from '../../lib/logger.js';

const REQUEST_TIMEOUT_MS = 5000;
const SIGNATURE_HEADER = 'X-Payment-Gateway-Signature';

export type SendWebhookInput = {
    orderId: string;
    paymentId: string;
    amountPaise: bigint;
    currency: string;
    status: 'SUCCESS' | 'FAILED';
    failureReason?: string;
};

export type SignedPayload = {
    body: string;
    signature: string;
};

/**
 * Builds the exact JSON bytes PayLedger will receive and signs those same
 * bytes — never a re-serialized copy, which could legitimately differ
 * byte-for-byte (key order, whitespace) from what actually gets sent.
 * Exported so the payload/signature contract can be unit-tested directly
 * without a network round trip.
 */
export const buildSignedPayload = (input: SendWebhookInput): SignedPayload => {
    const payload = {
        orderId: input.orderId,
        paymentId: input.paymentId,
        amount: Number(input.amountPaise),
        currency: input.currency,
        status: input.status,
        timestamp: new Date().toISOString(),
        ...(input.status === 'FAILED'
            ? { failureReason: input.failureReason ?? 'Payment declined' }
            : {}),
    };

    const body = JSON.stringify(payload);

    const signature = createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');

    return { body, signature };
};

/**
 * Fire-and-forget by design: delivery failure is only ever logged, never
 * thrown. Callers must commit the gateway payment's own state change
 * first and call this strictly afterwards — a failed delivery (timeout,
 * connection refused, 5xx, ...) must never roll back or otherwise affect
 * the fake payment's already-committed terminal state.
 *
 * `webhookUrl` defaults to the real configured destination; tests may
 * override it to point at a throwaway address to exercise the
 * delivery-failure path deterministically.
 */
export const sendPayledgerWebhook = async (
    input: SendWebhookInput,
    webhookUrl: string = env.PAYLEDGER_WEBHOOK_URL,
): Promise<void> => {
    const { body, signature } = buildSignedPayload(input);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SIGNATURE_HEADER]: signature,
            },
            body,
            signal: controller.signal,
        });

        if (!response.ok) {
            logger.error(
                {
                    orderId: input.orderId,
                    paymentId: input.paymentId,
                    statusCode: response.status,
                },
                'PayLedger webhook delivery was rejected',
            );
        }
    } catch (error) {
        logger.error(
            { error, orderId: input.orderId, paymentId: input.paymentId },
            'Failed to deliver webhook to PayLedger',
        );
    } finally {
        clearTimeout(timeout);
    }
};
