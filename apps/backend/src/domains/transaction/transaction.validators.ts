import { z } from 'zod';

export const listTransactionsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    type: z
        .enum(['DEPOSIT', 'TRANSFER', 'TRANSFER_REVERSAL', 'WITHDRAWAL'], {
            error: 'type must be DEPOSIT, TRANSFER, TRANSFER_REVERSAL, or WITHDRAWAL',
        })
        .optional(),
    status: z
        .enum(['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'], {
            error: 'status must be PENDING, COMPLETED, FAILED, or REVERSED',
        })
        .optional(),
    from: z.coerce
        .date({ error: 'from must be a valid ISO date' })
        .optional(),
    to: z.coerce.date({ error: 'to must be a valid ISO date' }).optional(),
});

export const transactionIdParamsSchema = z.object({
    id: z.uuid({ error: 'Transaction id must be a valid UUID' }),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type TransactionIdParams = z.infer<typeof transactionIdParamsSchema>;
