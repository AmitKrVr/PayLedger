import { z } from 'zod';

export const createGatewayPaymentSchema = z.object({
    orderId: z
        .string({ error: 'orderId is required' })
        .trim()
        .min(1, { error: 'orderId is required' }),

    amount: z
        .number({ error: 'amount is required' })
        .int({ error: 'amount must be an integer number of paise' })
        .positive({ error: 'amount must be greater than zero' }),

    currency: z.literal('INR', { error: 'currency must be INR' }),
});

export const gatewayPaymentIdParamsSchema = z.object({
    paymentId: z.uuid({ error: 'paymentId must be a valid UUID' }),
});

export const failurePaymentSchema = z.object({
    reason: z
        .string()
        .trim()
        .min(1)
        .max(500, { error: 'reason must not exceed 500 characters' })
        .optional(),
});

export type CreateGatewayPaymentInput = z.infer<
    typeof createGatewayPaymentSchema
>;
export type GatewayPaymentIdParams = z.infer<
    typeof gatewayPaymentIdParamsSchema
>;
export type FailurePaymentInput = z.infer<typeof failurePaymentSchema>;
