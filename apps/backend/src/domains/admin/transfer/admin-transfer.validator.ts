import { z } from 'zod';

export const transferIdParamsSchema = z.object({
    id: z.uuid({ error: 'Transfer id must be a valid UUID' }),
});

export type TransferIdParams = z.infer<typeof transferIdParamsSchema>;
