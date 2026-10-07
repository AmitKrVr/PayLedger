import { z } from 'zod';

// Same pattern as auth.validator.ts's user email check, duplicated
// locally since it validates a different field for a different purpose.
const EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const adminLoginSchema = z.object({
    email: z
        .string({ error: 'Email is required' })
        .trim()
        .toLowerCase()
        .regex(EMAIL_REGEX, {
            error: 'Please enter a valid email address',
        }),

    password: z
        .string({ error: 'Password is required' })
        .min(1, { error: 'Password is required' }),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
