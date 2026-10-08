import { z } from 'zod';

export const transferIdParamsSchema = z.object({
    id: z.uuid({ error: 'Transfer id must be a valid UUID' }),
});

export const listTransfersQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    status: z
        .enum(['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'], {
            error: 'status must be PENDING, COMPLETED, FAILED, or REVERSED',
        })
        .optional(),
    from: z.coerce.date({ error: 'from must be a valid ISO date' }).optional(),
    to: z.coerce.date({ error: 'to must be a valid ISO date' }).optional(),
    minAmount: z.coerce.number().positive().optional(),
    maxAmount: z.coerce.number().positive().optional(),
});

export type TransferIdParams = z.infer<typeof transferIdParamsSchema>;
export type ListTransfersQuery = z.infer<typeof listTransfersQuerySchema>;
