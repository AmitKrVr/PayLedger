import { z } from "zod"

// Mirrors apps/backend's auth.validator.ts / auth.constant.ts exactly --
// keep these bounds in sync with the backend if they ever change.
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/

export const registerSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(2, { error: "Name must be at least 2 characters" })
    .max(100, { error: "Name must not exceed 100 characters" }),
  mobile: z
    .string({ error: "Mobile number is required" })
    .trim()
    .regex(INDIAN_MOBILE_REGEX, {
      error: "Please enter a valid Indian mobile number",
    }),
  email: z
    .union([
      z.email({ error: "Please enter a valid email address" }).max(255),
      z.literal(""),
    ])
    .optional(),
  password: z
    .string({ error: "Password is required" })
    .min(8, { error: "Password must be at least 8 characters" })
    .max(128, { error: "Password must not exceed 128 characters" }),
})

export type RegisterFormData = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  mobile: z
    .string({ error: "Mobile number is required" })
    .trim()
    .regex(INDIAN_MOBILE_REGEX, {
      error: "Please enter a valid Indian mobile number",
    }),
  password: z.string({ error: "Password is required" }).min(1, {
    error: "Password is required",
  }),
})

export type LoginFormData = z.infer<typeof loginSchema>
