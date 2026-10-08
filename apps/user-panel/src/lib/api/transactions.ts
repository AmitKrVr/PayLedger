import { apiClient } from "./client"
import type { ApiPaginatedSuccess, ApiSuccess } from "./types"

/** Mirrors apps/backend's transaction.types.ts TransactionDto exactly. */
export type TransactionType = "DEPOSIT" | "TRANSFER" | "TRANSFER_REVERSAL" | "WITHDRAWAL"
export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED"
export type LedgerDirection = "CREDIT" | "DEBIT"

export interface TransactionCounterparty {
  userId: string
  name: string
}

export interface Transaction {
  id: string
  referenceId: string
  type: TransactionType
  status: TransactionStatus
  amount: number
  direction: LedgerDirection
  description: string | null
  counterparty: TransactionCounterparty | null
  createdAt: string
  completedAt: string | null
}

export interface ListTransactionsParams {
  page: number
  limit: number
  type?: TransactionType
  status?: TransactionStatus
  from?: string
  to?: string
}

export async function listTransactions(
  params: ListTransactionsParams
): Promise<{ items: Transaction[]; meta: ApiPaginatedSuccess<Transaction>["meta"] }> {
  const { data } = await apiClient.get<ApiPaginatedSuccess<Transaction>>(
    "/v1/transactions",
    { params }
  )
  return { items: data.data, meta: data.meta }
}

export async function getTransaction(id: string): Promise<Transaction> {
  const { data } = await apiClient.get<ApiSuccess<Transaction>>(
    `/v1/transactions/${id}`
  )
  return data.data
}
