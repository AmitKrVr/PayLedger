import { z } from 'zod';

import { env } from '@payledger/config';


const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export const recipientLookupSchema = z.object({
    mobile: z
        .string({ error: 'Mobile number is required' })
        .trim()
        .regex(INDIAN_MOBILE_REGEX, {
            error: 'Please enter a valid Indian mobile number',
        }),
});

export const createTransferSchema = z.object({
    recipientUserId: z.uuid({
        error: 'recipientUserId must be a valid UUID',
    }),
    amount: z
        .number({ error: 'Amount is required' })
        .positive({ error: 'Amount must be greater than zero' })
        .max(env.TRANSFER_MAX_AMOUNT_INR, {
            error: `Maximum transfer amount is ₹${env.TRANSFER_MAX_AMOUNT_INR}`,
        }),
});

export const idempotencyKeyHeaderSchema = z.object({
    'idempotency-key': z.uuid({
        error: 'Idempotency-Key must be a valid UUID',
    }),
});

export type RecipientLookupInput = z.infer<typeof recipientLookupSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
