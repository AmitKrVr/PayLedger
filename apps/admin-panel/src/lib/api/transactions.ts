import { apiClient } from "./client"
import type { ApiPaginatedSuccess, ApiSuccess, PaginationMeta } from "./types"

export type TransactionType = "DEPOSIT" | "TRANSFER" | "TRANSFER_REVERSAL" | "WITHDRAWAL"
export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED"
export type LedgerDirection = "CREDIT" | "DEBIT"

export interface TransactionUser {
  id: string
  name: string
  mobile: string
}

export interface TransactionListItem {
  id: string
  reference: string
  type: TransactionType
  status: TransactionStatus
  user: TransactionUser
  amount: number
  direction: LedgerDirection
  createdAt: string
  completedAt: string | null
}

export interface LedgerEntryDetail {
  id: string
  wallet: string
  direction: LedgerDirection
  amount: number
  currency: string
  balanceBefore: number
  balanceAfter: number
}

export interface TransactionDetail extends TransactionListItem {
  ledgerEntries: LedgerEntryDetail[]
}

export interface ListTransactionsParams {
  page: number
  limit: number
  search?: string
  type?: TransactionType
  status?: TransactionStatus
  userId?: string
  from?: string
  to?: string
  minAmount?: number
  maxAmount?: number
}

export async function listTransactions(
  params: ListTransactionsParams
): Promise<{ items: TransactionListItem[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiPaginatedSuccess<TransactionListItem>>(
    "/v1/admin/transactions",
    { params }
  )
  return { items: data.data, meta: data.meta }
}

export async function getTransaction(id: string): Promise<TransactionDetail> {
  const { data } = await apiClient.get<ApiSuccess<TransactionDetail>>(
    `/v1/admin/transactions/${id}`
  )
  return data.data
}
