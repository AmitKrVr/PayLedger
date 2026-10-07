import { pgEnum } from 'drizzle-orm/pg-core';

export const transactionTypeEnum = pgEnum('transaction_type', [
    'DEPOSIT',
    'TRANSFER',
    'TRANSFER_REVERSAL',
    'WITHDRAWAL',
]);

export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];

export const TransactionType: { [K in TransactionType]: K } = {
    DEPOSIT: 'DEPOSIT',
    TRANSFER: 'TRANSFER',
    TRANSFER_REVERSAL: 'TRANSFER_REVERSAL',
    WITHDRAWAL: 'WITHDRAWAL',
};

export const transactionStatusEnum = pgEnum('transaction_status', [
    'PENDING',
    'COMPLETED',
    'FAILED',
    'REVERSED',
]);

export type TransactionStatus =
    (typeof transactionStatusEnum.enumValues)[number];

export const TransactionStatus: {
    [K in TransactionStatus]: K;
} = {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REVERSED: 'REVERSED',
};

export const transactionSourceTypeEnum = pgEnum('transaction_source_type', [
    'PAYMENT',
    'TRANSFER',
    'WITHDRAWAL',
    'REVERSAL',
]);

export type TransactionSourceType =
    (typeof transactionSourceTypeEnum.enumValues)[number];

export const TransactionSourceType: {
    [K in TransactionSourceType]: K;
} = {
    PAYMENT: 'PAYMENT',
    TRANSFER: 'TRANSFER',
    WITHDRAWAL: 'WITHDRAWAL',
    REVERSAL: 'REVERSAL',
};