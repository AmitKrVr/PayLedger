import { z } from 'zod';

import { env } from '@payledger/config';

export const createWithdrawalSchema = z.object({
    amount: z
        .number({ error: 'Amount is required' })
        .positive({ error: 'Amount must be greater than zero' })
        .min(env.WITHDRAWAL_MIN_AMOUNT_INR, {
            error: `Minimum withdrawal amount is ₹${env.WITHDRAWAL_MIN_AMOUNT_INR}`,
        })
        .max(env.WITHDRAWAL_MAX_AMOUNT_INR, {
            error: `Maximum withdrawal amount is ₹${env.WITHDRAWAL_MAX_AMOUNT_INR}`,
        }),
});

export const idempotencyKeyHeaderSchema = z.object({
    'idempotency-key': z.uuid({
        error: 'Idempotency-Key must be a valid UUID',
    }),
});

export const listWithdrawalsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z
        .enum(['PENDING', 'APPROVED', 'REJECTED'], {
            error: 'status must be PENDING, APPROVED, or REJECTED',
        })
        .optional(),
});

export const withdrawalIdParamsSchema = z.object({
    id: z.uuid({ error: 'Withdrawal id must be a valid UUID' }),
});

export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;
export type ListWithdrawalsQuery = z.infer<typeof listWithdrawalsQuerySchema>;
export type WithdrawalIdParams = z.infer<typeof withdrawalIdParamsSchema>;
