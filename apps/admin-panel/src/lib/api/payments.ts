import { apiClient } from "./client"
import type { ApiPaginatedSuccess, ApiSuccess, PaginationMeta } from "./types"

export type PaymentStatus =
  | "CREATED"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"

export interface PaymentUser {
  id: string
  name: string
  mobile: string
}

export interface PaymentListItem {
  id: string
  orderId: string
  user: PaymentUser
  amount: number
  status: PaymentStatus
  provider: string
  createdAt: string
  paidAt: string | null
  expiresAt: string | null
}

export interface PaymentDetail {
  id: string
  orderId: string
  paymentId: string | null
  user: PaymentUser
  amount: number
  currency: string
  status: PaymentStatus
  provider: string
  failureReason: string | null
  createdAt: string
  updatedAt: string
  paidAt: string | null
  expiresAt: string | null
}

export interface ListPaymentsParams {
  page: number
  limit: number
  search?: string
  status?: PaymentStatus
  from?: string
  to?: string
  minAmount?: number
  maxAmount?: number
}

export async function listPayments(
  params: ListPaymentsParams
): Promise<{ items: PaymentListItem[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiPaginatedSuccess<PaymentListItem>>(
    "/v1/admin/payments",
    { params }
  )
  return { items: data.data, meta: data.meta }
}

export async function getPayment(id: string): Promise<PaymentDetail> {
  const { data } = await apiClient.get<ApiSuccess<PaymentDetail>>(
    `/v1/admin/payments/${id}`
  )
  return data.data
}
