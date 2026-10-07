import { z } from 'zod';
import { AUTH_LIMITS } from './auth.constant.js';

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;


export const registerSchema = z.object({
    name: z
        .string({
            error: 'Name is required',
        })
        .trim()
        .min(2, {
            error: `Name must be at least ${AUTH_LIMITS.NAME_MIN_LENGTH} characters`,
        })
        .max(100, {
            error: `Name must not exceed ${AUTH_LIMITS.NAME_MAX_LENGTH} characters`,
        }),

    mobile: z
        .string({
            error: 'Mobile number is required',
        })
        .trim()
        .regex(INDIAN_MOBILE_REGEX, {
            error: 'Please enter a valid Indian mobile number',
        }),

    email: z
        .string({
            error: 'Email is required',
        })
        .trim()
        .regex(EMAIL_REGEX, {
            error: 'Please enter a valid email address',
        })
        .max(255, {
            error: 'Email must not exceed 255 characters',
        })
        .optional(),

    password: z
        .string({
            error: 'Password is required',
        })
        .min(8, {
            error: `Password must be at least ${AUTH_LIMITS.PASSWORD_MIN_LENGTH} characters`,
        })
        .max(128, {
            error: `Password must not exceed ${AUTH_LIMITS.PASSWORD_MAX_LENGTH} characters`,
        }),
});

export const loginSchema = z.object({
    mobile: z
        .string({
            error: 'Mobile number is required',
        })
        .trim()
        .regex(INDIAN_MOBILE_REGEX, {
            error: 'Please enter a valid Indian mobile number',
        }),

    password: z
        .string({
            error: 'Password is required',
        })
        .min(1, {
            error: 'Password is required',
        }),
});


export const adminLoginSchema = z.object({
    mobile: z
        .string({
            error: 'Mobile number is required',
        })
        .trim()
        .regex(/^\+?[1-9]\d{9,19}$/, {
            error: 'Please enter a valid mobile number',
        }),

    password: z
        .string({
            error: 'Password is required',
        })
        .min(1, {
            error: 'Password is required',
        }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;