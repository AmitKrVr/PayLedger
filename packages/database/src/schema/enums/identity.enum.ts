import { pgEnum } from 'drizzle-orm/pg-core';

export const userStatusEnum = pgEnum('user_status', [
    'PENDING',
    'ACTIVE',
    'BLOCKED',
]);

export type UserStatus = (typeof userStatusEnum.enumValues)[number];

export const UserStatus: { [K in UserStatus]: K } = {
    PENDING: 'PENDING',
    ACTIVE: 'ACTIVE',
    BLOCKED: 'BLOCKED',
};

export const adminRoleEnum = pgEnum('admin_role', [
    'ADMIN',
    'SUPER_ADMIN',
]);

export type AdminRole = (typeof adminRoleEnum.enumValues)[number];

export const AdminRole: { [K in AdminRole]: K } = {
    ADMIN: 'ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN',
};

export const adminStatusEnum = pgEnum('admin_status', [
    'ACTIVE',
    'BLOCKED',
    'SUSPENDED',
]);

export type AdminStatus = (typeof adminStatusEnum.enumValues)[number];

export const AdminStatus: { [K in AdminStatus]: K } = {
    ACTIVE: 'ACTIVE',
    BLOCKED: 'BLOCKED',
    SUSPENDED: 'SUSPENDED',
};