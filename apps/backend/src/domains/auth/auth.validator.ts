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
        .min(AUTH_LIMITS.NAME_MIN_LENGTH, {
            error: `Name must be at least ${AUTH_LIMITS.NAME_MIN_LENGTH} characters`,
        })
        .max(AUTH_LIMITS.NAME_MAX_LENGTH, {
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
        .max(AUTH_LIMITS.EMAIL_MAX_LENGTH, {
            error: `Email must not exceed ${AUTH_LIMITS.EMAIL_MAX_LENGTH} characters`,
        })
        .optional(),

    password: z
        .string({
            error: 'Password is required',
        })
        .min(AUTH_LIMITS.PASSWORD_MIN_LENGTH, {
            error: `Password must be at least ${AUTH_LIMITS.PASSWORD_MIN_LENGTH} characters`,
        })
        .max(AUTH_LIMITS.PASSWORD_MAX_LENGTH, {
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