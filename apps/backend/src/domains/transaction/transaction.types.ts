import type {
    LedgerDirection,
    TransactionStatus,
    TransactionType,
} from '@payledger/database';

export type Counterparty = {
    userId: string;
    name: string;
};

export type TransactionDto = {
    id: string;
    referenceId: string;
    type: TransactionType;
    status: TransactionStatus;
    amount: number;
    direction: LedgerDirection;
    description: string | null;
    counterparty: Counterparty | null;
    createdAt: Date;
    completedAt: Date | null;
};
