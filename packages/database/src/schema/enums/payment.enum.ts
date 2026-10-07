import { pgEnum } from 'drizzle-orm/pg-core';

export const paymentStatusEnum = pgEnum('payment_status', [
    'CREATED',
    'PROCESSING',
    'SUCCESS',
    'FAILED',
    'CANCELLED',
    'EXPIRED',
]);

export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];

export const PaymentStatus: { [K in PaymentStatus]: K } = {
    CREATED: 'CREATED',
    PROCESSING: 'PROCESSING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED',
};