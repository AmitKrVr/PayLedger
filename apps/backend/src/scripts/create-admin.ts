import { createInterface } from 'node:readline';

import {
    AdminRole,
    AdminStatus,
    admins,
    closeConnection,
    db,
} from '@payledger/database';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { findAdminByEmail } from '../domains/admin/auth/admin-auth.repository.js';
import { AUTH_LIMITS } from '../domains/auth/auth.constant.js';
import { hashPassword } from '../lib/auth/auth.js';

const EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

const createAdminSchema = z
    .object({
        name: z
            .string({ error: 'Name is required' })
            .trim()
            .min(AUTH_LIMITS.NAME_MIN_LENGTH, {
                error: `Name must be at least ${AUTH_LIMITS.NAME_MIN_LENGTH} characters`,
            })
            .max(AUTH_LIMITS.NAME_MAX_LENGTH, {
                error: `Name must not exceed ${AUTH_LIMITS.NAME_MAX_LENGTH} characters`,
            }),
        email: z
            .string({ error: 'Email is required' })
            .trim()
            .toLowerCase()
            .regex(EMAIL_REGEX, {
                error: 'Please enter a valid email address',
            })
            .max(AUTH_LIMITS.EMAIL_MAX_LENGTH, {
                error: `Email must not exceed ${AUTH_LIMITS.EMAIL_MAX_LENGTH} characters`,
            }),
        mobile: z
            .string({ error: 'Mobile number is required' })
            .trim()
            .regex(INDIAN_MOBILE_REGEX, {
                error: 'Please enter a valid 10-digit Indian mobile number',
            }),
        password: z
            .string({ error: 'Password is required' })
            .min(AUTH_LIMITS.PASSWORD_MIN_LENGTH, {
                error: `Password must be at least ${AUTH_LIMITS.PASSWORD_MIN_LENGTH} characters`,
            })
            .max(AUTH_LIMITS.PASSWORD_MAX_LENGTH, {
                error: `Password must not exceed ${AUTH_LIMITS.PASSWORD_MAX_LENGTH} characters`,
            }),
        confirmPassword: z.string({ error: 'Confirm password is required' }),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });

function getPromptReader() {
    const isTTY = Boolean(process.stdin.isTTY);

    if (!isTTY) {
        const rl = createInterface({ input: process.stdin, terminal: false });
        const iterator = rl[Symbol.asyncIterator]();

        return {
            prompt: async (query: string): Promise<string> => {
                process.stdout.write(query);
                const next = await iterator.next();
                return next.done ? '' : String(next.value ?? '').trim();
            },
            promptPassword: async (query: string): Promise<string> => {
                process.stdout.write(query);
                const next = await iterator.next();
                return next.done ? '' : String(next.value ?? '').trim();
            },
            close: () => {
                rl.close();
            },
        };
    }

    const prompt = (query: string): Promise<string> =>
        new Promise((resolve) => {
            const rl = createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            rl.question(query, (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });

    const promptPassword = (query: string): Promise<string> =>
        new Promise((resolve) => {
            process.stdout.write(query);
            process.stdin.setRawMode(true);
            process.stdin.resume();

            let secret = '';
            const onData = (chunk: Buffer) => {
                const str = chunk.toString('utf8');
                for (const char of str) {
                    if (char === '\r' || char === '\n') {
                        process.stdin.setRawMode(false);
                        process.stdin.pause();
                        process.stdin.off('data', onData);
                        process.stdout.write('\n');
                        resolve(secret);
                        return;
                    }
                    if (char === '\u0003') {
                        // Ctrl+C
                        process.stdin.setRawMode(false);
                        process.stdout.write('\n');
                        closeConnection().finally(() => process.exit(130));
                        return;
                    }
                    if (char === '\x7f' || char === '\b') {
                        if (secret.length > 0) {
                            secret = secret.slice(0, -1);
                        }
                    } else {
                        secret += char;
                    }
                }
            };

            process.stdin.on('data', onData);
        });

    return {
        prompt,
        promptPassword,
        close: () => {},
    };
}

let isCleaningUp = false;
const cleanup = async () => {
    if (isCleaningUp) return;
    isCleaningUp = true;
    try {
        await closeConnection();
    } catch {
        // Ignore errors during exit cleanup
    }
};

process.on('SIGINT', () => {
    console.log('\nOperation cancelled.');
    cleanup().finally(() => process.exit(130));
});

process.on('SIGTERM', () => {
    cleanup().finally(() => process.exit(143));
});

export async function createAdmin(): Promise<void> {
    const reader = getPromptReader();

    try {
        console.log('--- PayLedger Admin Creation ---\n');

        const name = await reader.prompt('1. Admin name: ');
        const email = await reader.prompt('2. Admin email: ');
        const mobile = await reader.prompt('3. Admin mobile: ');
        const password = await reader.promptPassword('4. Password: ');
        const confirmPassword = await reader.promptPassword(
            '5. Confirm password: ',
        );

        const validation = createAdminSchema.safeParse({
            name,
            email,
            mobile,
            password,
            confirmPassword,
        });

        if (!validation.success) {
            const firstError = validation.error.issues[0]?.message ?? 'Invalid input';
            console.error(`\nValidation error: ${firstError}`);
            reader.close();
            await cleanup();
            process.exit(1);
        }

        const validData = validation.data;

        // Check if admin already exists by email
        const existingAdminByEmail = await findAdminByEmail(validData.email);
        if (existingAdminByEmail) {
            console.error(
                `\nError: An admin with email "${validData.email}" already exists.`,
            );
            reader.close();
            await cleanup();
            process.exit(1);
        }

        // Check if admin already exists by mobile
        const [existingAdminByMobile] = await db
            .select({ id: admins.id })
            .from(admins)
            .where(eq(admins.mobile, validData.mobile))
            .limit(1);

        if (existingAdminByMobile) {
            console.error(
                `\nError: An admin with mobile number "${validData.mobile}" already exists.`,
            );
            reader.close();
            await cleanup();
            process.exit(1);
        }

        // Confirmation summary
        console.log('\nCreate PayLedger admin?\n');
        console.log(`  Name:   ${validData.name}`);
        console.log(`  Email:  ${validData.email}`);
        console.log(`  Mobile: ${validData.mobile}\n`);

        const confirmation = await reader.prompt('Continue? [y/N]: ');
        reader.close();

        if (
            confirmation.toLowerCase() !== 'y' &&
            confirmation.toLowerCase() !== 'yes'
        ) {
            console.log('Admin creation cancelled.');
            await cleanup();
            process.exit(0);
        }

        // Hash password securely with Argon2id
        const passwordHash = await hashPassword(validData.password);

        // Insert into database respecting defaults
        const [createdAdmin] = await db
            .insert(admins)
            .values({
                name: validData.name,
                email: validData.email,
                mobile: validData.mobile,
                passwordHash,
                role: AdminRole.ADMIN,
                status: AdminStatus.ACTIVE,
            })
            .returning();

        if (!createdAdmin) {
            throw new Error('Failed to create admin record.');
        }

        console.log('\nAdmin created successfully:');
        console.log(`  ID:     ${createdAdmin.id}`);
        console.log(`  Name:   ${createdAdmin.name}`);
        console.log(`  Email:  ${createdAdmin.email}`);
        console.log(`  Mobile: ${createdAdmin.mobile}`);
        console.log(`  Role:   ${createdAdmin.role}`);
        console.log(`  Status: ${createdAdmin.status}`);

        await cleanup();
        process.exit(0);
    } catch (error) {
        reader.close();
        console.error(
            '\nError creating admin:',
            error instanceof Error ? error.message : error,
        );
        await cleanup();
        process.exit(1);
    }
}

// Execute when invoked directly
createAdmin();
