import { z } from 'zod';

export const listPaymentsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    status: z
        .enum(['CREATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED'], {
            error:
                'status must be CREATED, PROCESSING, SUCCESS, FAILED, CANCELLED, or EXPIRED',
        })
        .optional(),
    from: z.coerce.date({ error: 'from must be a valid ISO date' }).optional(),
    to: z.coerce.date({ error: 'to must be a valid ISO date' }).optional(),
    minAmount: z.coerce.number().positive().optional(),
    maxAmount: z.coerce.number().positive().optional(),
});

export const paymentIdParamsSchema = z.object({
    id: z.uuid({ error: 'Payment id must be a valid UUID' }),
});

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
export type PaymentIdParams = z.infer<typeof paymentIdParamsSchema>;
