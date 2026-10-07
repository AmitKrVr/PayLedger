import { pgEnum } from 'drizzle-orm/pg-core';

export const transferStatusEnum = pgEnum('transfer_status', [
    'PENDING',
    'COMPLETED',
    'FAILED',
    'REVERSED',
]);

export type TransferStatus = (typeof transferStatusEnum.enumValues)[number];

export const TransferStatus: { [K in TransferStatus]: K } = {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REVERSED: 'REVERSED',
};