import { z } from 'zod';

export const listUsersQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    status: z
        .enum(['PENDING', 'ACTIVE', 'BLOCKED'], {
            error: 'status must be PENDING, ACTIVE, or BLOCKED',
        })
        .optional(),
    walletStatus: z
        .enum(['ACTIVE', 'BLOCKED'], {
            error: 'walletStatus must be ACTIVE or BLOCKED',
        })
        .optional(),
    from: z.coerce.date({ error: 'from must be a valid ISO date' }).optional(),
    to: z.coerce.date({ error: 'to must be a valid ISO date' }).optional(),
    sort: z.enum(['newest', 'oldest']).default('newest'),
});

export const userIdParamsSchema = z.object({
    id: z.uuid({ error: 'User id must be a valid UUID' }),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
