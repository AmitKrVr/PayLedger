import { env } from '@payledger/config';

export type LimitsResponse = {
    payment: { minAmount: number; maxAmount: number };
    withdrawal: { minAmount: number; maxAmount: number };
    transfer: {
        maxAmount: number;
        dailyLimit: number;
        feePercent: number;
        feeMinAmount: number;
        feeMaxAmount: number;
    };
};

export const getLimits = (): LimitsResponse => ({
    payment: {
        minAmount: env.PAYMENT_MIN_DEPOSIT_INR,
        maxAmount: env.PAYMENT_MAX_DEPOSIT_INR,
    },
    withdrawal: {
        minAmount: env.WITHDRAWAL_MIN_AMOUNT_INR,
        maxAmount: env.WITHDRAWAL_MAX_AMOUNT_INR,
    },
    transfer: {
        maxAmount: env.TRANSFER_MAX_AMOUNT_INR,
        dailyLimit: env.TRANSFER_DAILY_LIMIT_INR,
        feePercent: env.TRANSFER_FEE_PERCENT,
        feeMinAmount: env.TRANSFER_FEE_MIN_INR,
        feeMaxAmount: env.TRANSFER_FEE_MAX_INR,
    },
});
