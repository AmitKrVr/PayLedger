import type {
    DatabaseOrTransaction,
    WalletStatus,
} from '@payledger/database';

export type WalletResponse = {
    id: string;
    balance: number;
    held: number;
    available: number;
    status: WalletStatus;
};

type WalletMutationInput = {
    walletId: string;
    amountPaise: bigint;
    tx: DatabaseOrTransaction;
};

export type CreditWalletInput = WalletMutationInput & {
    transactionId: string;
};

export type DebitWalletInput = WalletMutationInput & {
    transactionId: string;
};

export type HoldWalletInput = WalletMutationInput;

export type ReleaseWalletHoldInput = WalletMutationInput;
