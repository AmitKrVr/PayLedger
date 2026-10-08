import { apiClient } from "./client"
import type { ApiPaginatedSuccess, ApiSuccess, PaginationMeta } from "./types"

/** Mirrors apps/backend's admin-withdrawal domain response shapes --
 * keep in sync with the backend if those fields change. */
export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface WithdrawalListItem {
  id: string
  reference: string | null
  user: {
    id: string
    name: string
    mobile: string
  }
  amount: number
  status: WithdrawalStatus
  requestedAt: string
  processedAt: string | null
}

export interface WithdrawalDetail extends WithdrawalListItem {
  rejectionReason: string | null
  processedByAdminName: string | null
}

export interface ListWithdrawalsParams {
  page: number
  limit: number
  search?: string
  status?: WithdrawalStatus
}

export interface ApprovedWithdrawal {
  id: string
  status: WithdrawalStatus
  transactionId: string
  processedAt: string
}

export interface RejectedWithdrawal {
  id: string
  status: WithdrawalStatus
  rejectionReason: string
  processedAt: string
}

export async function listWithdrawals(
  params: ListWithdrawalsParams
): Promise<{ items: WithdrawalListItem[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiPaginatedSuccess<WithdrawalListItem>>(
    "/v1/admin/withdrawals",
    { params }
  )
  return { items: data.data, meta: data.meta }
}

export async function getWithdrawal(id: string): Promise<WithdrawalDetail> {
  const { data } = await apiClient.get<ApiSuccess<WithdrawalDetail>>(
    `/v1/admin/withdrawals/${id}`
  )
  return data.data
}

export async function approveWithdrawal(id: string): Promise<ApprovedWithdrawal> {
  const { data } = await apiClient.post<ApiSuccess<ApprovedWithdrawal>>(
    `/v1/admin/withdrawals/${id}/approve`
  )
  return data.data
}

export async function rejectWithdrawal(
  id: string,
  reason: string
): Promise<RejectedWithdrawal> {
  const { data } = await apiClient.post<ApiSuccess<RejectedWithdrawal>>(
    `/v1/admin/withdrawals/${id}/reject`,
    { reason }
  )
  return data.data
}
