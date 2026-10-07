import { pgEnum } from 'drizzle-orm/pg-core';

export const walletStatusEnum = pgEnum('wallet_status', [
    'ACTIVE',
    'BLOCKED',
]);

export type WalletStatus = (typeof walletStatusEnum.enumValues)[number];

export const WalletStatus: { [K in WalletStatus]: K } = {
    ACTIVE: 'ACTIVE',
    BLOCKED: 'BLOCKED',
};

export const walletTypeEnum = pgEnum('wallet_type', [
    'USER',
    'SYSTEM',
]);

export type WalletType = (typeof walletTypeEnum.enumValues)[number];

export const WalletType: { [K in WalletType]: K } = {
    USER: 'USER',
    SYSTEM: 'SYSTEM',
};

export const ledgerDirectionEnum = pgEnum('ledger_direction', [
    'CREDIT',
    'DEBIT',
]);

export type LedgerDirection = (typeof ledgerDirectionEnum.enumValues)[number];

export const LedgerDirection: { [K in LedgerDirection]: K } = {
    CREDIT: 'CREDIT',
    DEBIT: 'DEBIT',
};