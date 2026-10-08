import { pgEnum } from 'drizzle-orm/pg-core';

export const gatewayPaymentStatusEnum = pgEnum('gateway_payment_status', [
    'CREATED',
    'PROCESSING',
    'SUCCESS',
    'FAILED',
]);

export type GatewayPaymentStatus =
    (typeof gatewayPaymentStatusEnum.enumValues)[number];

export const GatewayPaymentStatus: {
    [K in GatewayPaymentStatus]: K;
} = {
    CREATED: 'CREATED',
    PROCESSING: 'PROCESSING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
};
