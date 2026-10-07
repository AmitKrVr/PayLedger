
import {
    index,
    inet,
    integer,
    pgTable,
    timestamp,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';

import {
    adminRoleEnum,
    adminStatusEnum,
    userStatusEnum,
} from './enums/index.js';

export const users = pgTable(
    'users',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: varchar('name', { length: 100 }).notNull(),
        mobile: varchar('mobile', { length: 20 }).notNull().unique(),
        email: varchar('email', { length: 255 }).unique(),
        passwordHash: varchar('password_hash', { length: 255 }).notNull(),
        status: userStatusEnum('status').notNull().default('PENDING'),
        failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
        lockedUntil: timestamp('locked_until', { withTimezone: true }),
        lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('users_status_idx').on(table.status),
        index('users_created_at_idx').on(table.createdAt),
    ],
);

export const userSessions = pgTable(
    'user_sessions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        refreshTokenHash: varchar('refresh_token_hash', { length: 64 })
            .notNull(),
        refreshTokenJti: uuid('refresh_token_jti').notNull().unique(),
        deviceName: varchar('device_name', { length: 100 }),
        ipAddress: inet('ip_address'),
        userAgent: varchar('user_agent', { length: 500 }),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('user_sessions_user_id_idx').on(table.userId),
        index('user_sessions_expires_at_idx').on(table.expiresAt),
    ],
);

export const admins = pgTable(
    'admins',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: varchar('name', { length: 100 }).notNull(),
        mobile: varchar('mobile', { length: 20 }).notNull().unique(),
        email: varchar('email', { length: 255 }).notNull().unique(),
        passwordHash: varchar('password_hash', { length: 255 }).notNull(),
        role: adminRoleEnum('role').notNull().default('ADMIN'),
        status: adminStatusEnum('status').notNull().default('ACTIVE'),
        failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
        lockedUntil: timestamp('locked_until', { withTimezone: true }),
        lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('admins_status_idx').on(table.status),
        index('admins_created_at_idx').on(table.createdAt),
    ],
);

export const adminSessions = pgTable(
    'admin_sessions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        adminId: uuid('admin_id')
            .notNull()
            .references(() => admins.id, { onDelete: 'cascade' }),
        refreshTokenHash: varchar('refresh_token_hash', { length: 64 })
            .notNull(),
        refreshTokenJti: uuid('refresh_token_jti').notNull().unique(),
        deviceName: varchar('device_name', { length: 100 }),
        ipAddress: inet('ip_address'),
        userAgent: varchar('user_agent', { length: 500 }),
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
        lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
        revokedAt: timestamp('revoked_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('admin_sessions_admin_id_idx').on(table.adminId),
        index('admin_sessions_expires_at_idx').on(table.expiresAt),
    ],
);