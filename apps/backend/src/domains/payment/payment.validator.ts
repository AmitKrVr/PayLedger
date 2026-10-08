import { z } from 'zod';

import { env } from '@payledger/config';

export const createPaymentSchema = z.object({
    amount: z
        .number({ error: 'Amount is required' })
        .positive({ error: 'Amount must be greater than zero' })
        .min(env.PAYMENT_MIN_DEPOSIT_INR, {
            error: `Minimum deposit is ₹${env.PAYMENT_MIN_DEPOSIT_INR}`,
        })
        .max(env.PAYMENT_MAX_DEPOSIT_INR, {
            error: `Maximum deposit is ₹${env.PAYMENT_MAX_DEPOSIT_INR}`,
        }),
});

export const paymentIdParamsSchema = z.object({
    id: z.uuid({ error: 'Payment id must be a valid UUID' }),
});

export const idempotencyKeyHeaderSchema = z.object({
    'idempotency-key': z.uuid({
        error: 'Idempotency-Key must be a valid UUID',
    }),
});

// Lets an authenticated user drive their own CREATED/PROCESSING payment to
// a terminal state via the Fake Payment Gateway's simulate endpoints --
// this is the gateway's own test-checkout action, proxied through the
// backend so the frontend never calls the gateway directly. The resulting
// SUCCESS/FAILED state always arrives back through the normal signed
// webhook, never set directly by this endpoint.
export const simulatePaymentSchema = z.object({
    outcome: z.enum(['SUCCESS', 'FAILED'], {
        error: 'outcome must be SUCCESS or FAILED',
    }),
    reason: z.string().trim().min(1).max(500).optional(),
});

export const webhookPayloadSchema = z.object({
    orderId: z.string({ error: 'orderId is required' }).min(1),
    paymentId: z.string({ error: 'paymentId is required' }).min(1),
    status: z.enum(['SUCCESS', 'FAILED'], {
        error: 'status must be SUCCESS or FAILED',
    }),
    // Paise, matching the Fake Payment Gateway's webhook contract —
    // unlike createPaymentSchema.amount above, this is NOT INR.
    amount: z
        .number({ error: 'amount is required' })
        .int({ error: 'amount must be an integer number of paise' })
        .positive({ error: 'amount must be greater than zero' }),
    failureReason: z.string().max(500).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentIdParams = z.infer<typeof paymentIdParamsSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
export type SimulatePaymentInput = z.infer<typeof simulatePaymentSchema>;
