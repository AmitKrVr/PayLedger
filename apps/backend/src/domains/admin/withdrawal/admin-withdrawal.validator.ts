import { z } from 'zod';

export const listWithdrawalsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    status: z
        .enum(['PENDING', 'APPROVED', 'REJECTED'], {
            error: 'status must be PENDING, APPROVED, or REJECTED',
        })
        .optional(),
});

export const withdrawalIdParamsSchema = z.object({
    id: z.uuid({ error: 'Withdrawal id must be a valid UUID' }),
});

export const rejectWithdrawalSchema = z.object({
    reason: z
        .string({ error: 'Rejection reason is required' })
        .trim()
        .min(3, { error: 'Rejection reason must be at least 3 characters' })
        .max(500, {
            error: 'Rejection reason must not exceed 500 characters',
        }),
});

export type ListWithdrawalsQuery = z.infer<typeof listWithdrawalsQuerySchema>;
export type WithdrawalIdParams = z.infer<typeof withdrawalIdParamsSchema>;
export type RejectWithdrawalInput = z.infer<typeof rejectWithdrawalSchema>;
