import type { GatewayPaymentStatus } from '@payledger/database';

export type GatewayPaymentResponse = {
    id: string;
    orderId: string;
    paymentId: string;
    amount: number;
    currency: string;
    status: GatewayPaymentStatus;
};
