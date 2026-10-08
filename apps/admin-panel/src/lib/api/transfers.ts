import { apiClient } from "./client"
import type { ApiPaginatedSuccess, ApiSuccess, PaginationMeta } from "./types"

/** Mirrors apps/backend's admin-transfer domain response shapes -- keep
 * in sync with the backend if those fields change. */
export type TransferStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED"

export interface TransferParty {
  id: string
  name: string
  mobile: string
}

export interface TransferListItem {
  id: string
  reference: string
  sender: TransferParty
  recipient: TransferParty
  amount: number
  fee: number
  total: number
  status: TransferStatus
  createdAt: string
  completedAt: string | null
}

export interface TransferDetail extends TransferListItem {
  reversedAt: string | null
  reversalReference: string | null
}

export interface ListTransfersParams {
  page: number
  limit: number
  search?: string
  status?: TransferStatus
  from?: string
  to?: string
  minAmount?: number
  maxAmount?: number
}

export interface ReversedTransfer {
  transferId: string
  reversalTransactionId: string
  referenceId: string
  status: TransferStatus
  processedAt: string | null
}

export async function listTransfers(
  params: ListTransfersParams
): Promise<{ items: TransferListItem[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiPaginatedSuccess<TransferListItem>>(
    "/v1/admin/transfers",
    { params }
  )
  return { items: data.data, meta: data.meta }
}

export async function getTransfer(id: string): Promise<TransferDetail> {
  const { data } = await apiClient.get<ApiSuccess<TransferDetail>>(
    `/v1/admin/transfers/${id}`
  )
  return data.data
}

export async function reverseTransfer(id: string): Promise<ReversedTransfer> {
  const { data } = await apiClient.post<ApiSuccess<ReversedTransfer>>(
    `/v1/admin/transfers/${id}/reverse`
  )
  return data.data
}
