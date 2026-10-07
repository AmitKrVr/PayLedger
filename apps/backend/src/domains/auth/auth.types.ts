import type { AdminRole } from '@payledger/database';

export type UserAuthContext = {
    userId: string;
    sessionId: string;
};

export type AdminAuthContext = {
    adminId: string;
    sessionId: string;
    role: AdminRole;
};

export type SessionDeviceInfo = {
    deviceName?: string;
    ipAddress?: string;
    userAgent?: string;
};

export type CreateUserSessionInput = SessionDeviceInfo & {
    userId: string;
    refreshTokenJti: string;
    refreshTokenHash: string;
    expiresAt: Date;
};

export type CreateAdminSessionInput = SessionDeviceInfo & {
    adminId: string;
    refreshTokenJti: string;
    refreshTokenHash: string;
    expiresAt: Date;
};