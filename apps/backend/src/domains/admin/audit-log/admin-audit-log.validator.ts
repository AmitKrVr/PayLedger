import { z } from 'zod';

export const listAuditLogsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    action: z.string().trim().min(1).max(100).optional(),
    adminId: z.uuid().optional(),
    targetType: z.string().trim().min(1).max(50).optional(),
    from: z.coerce.date({ error: 'from must be a valid ISO date' }).optional(),
    to: z.coerce.date({ error: 'to must be a valid ISO date' }).optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
