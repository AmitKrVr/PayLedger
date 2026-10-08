import { apiClient } from "./client"
import type { ApiPaginatedSuccess, ApiSuccess, PaginationMeta } from "./types"

/** Mirrors apps/backend's withdrawal.service.ts WithdrawalResponse exactly. */
export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface Withdrawal {
  id: string
  amount: number
  status: WithdrawalStatus
  requestedAt: string
}

/** Mirrors apps/backend's withdrawal.service.ts WithdrawalHistoryItem --
 * the `GET /v1/withdrawals` / `GET /v1/withdrawals/:id` response shape. */
export interface WithdrawalHistoryItem {
  id: string
  reference: string | null
  amount: number
  status: WithdrawalStatus
  createdAt: string
  updatedAt: string
  processedAt: string | null
  rejectionReason: string | null
}

export interface ListWithdrawalsParams {
  page: number
  limit: number
  status?: WithdrawalStatus
}

export async function createWithdrawal(
  amount: number,
  idempotencyKey: string
): Promise<Withdrawal> {
  const { data } = await apiClient.post<ApiSuccess<Withdrawal>>(
    "/v1/withdrawals",
    { amount },
    { headers: { "Idempotency-Key": idempotencyKey } }
  )
  return data.data
}

export async function listWithdrawals(
  params: ListWithdrawalsParams
): Promise<{ items: WithdrawalHistoryItem[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiPaginatedSuccess<WithdrawalHistoryItem>>(
    "/v1/withdrawals",
    { params }
  )
  return { items: data.data, meta: data.meta }
}

export async function getWithdrawal(id: string): Promise<WithdrawalHistoryItem> {
  const { data } = await apiClient.get<ApiSuccess<WithdrawalHistoryItem>>(
    `/v1/withdrawals/${id}`
  )
  return data.data
}
