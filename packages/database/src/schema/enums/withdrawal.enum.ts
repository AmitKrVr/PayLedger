import { pgEnum } from 'drizzle-orm/pg-core';

export const withdrawalStatusEnum = pgEnum('withdrawal_status', [
    'PENDING',
    'APPROVED',
    'REJECTED',
]);

export type WithdrawalStatus =
    (typeof withdrawalStatusEnum.enumValues)[number];

export const WithdrawalStatus: {
    [K in WithdrawalStatus]: K;
} = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
};