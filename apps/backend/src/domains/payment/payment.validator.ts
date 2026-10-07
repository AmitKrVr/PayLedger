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

export const webhookPayloadSchema = z.object({
    orderId: z.string({ error: 'orderId is required' }).min(1),
    paymentId: z.string({ error: 'paymentId is required' }).min(1),
    status: z.enum(['SUCCESS', 'FAILED'], {
        error: 'status must be SUCCESS or FAILED',
    }),
    amount: z
        .number({ error: 'amount is required' })
        .positive({ error: 'amount must be greater than zero' }),
    failureReason: z.string().max(500).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentIdParams = z.infer<typeof paymentIdParamsSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
