import { apiClient } from "./client"
import type { ApiPaginatedSuccess, ApiSuccess, PaginationMeta } from "./types"

/** Mirrors apps/backend's payment.service.ts PaymentResponse exactly. */
export type PaymentStatus =
  | "CREATED"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"

export interface Payment {
  id: string
  orderId: string
  amount: number
  status: PaymentStatus
  failureReason: string | null
  createdAt: string
  expiresAt: string | null
}

export interface ListPaymentsParams {
  page: number
  limit: number
  status?: PaymentStatus
}

export async function createPayment(
  amount: number,
  idempotencyKey: string
): Promise<Payment> {
  const { data } = await apiClient.post<ApiSuccess<Payment>>(
    "/v1/payments",
    { amount },
    { headers: { "Idempotency-Key": idempotencyKey } }
  )
  return data.data
}

export async function listPayments(
  params: ListPaymentsParams
): Promise<{ items: Payment[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiPaginatedSuccess<Payment>>("/v1/payments", {
    params,
  })
  return { items: data.data, meta: data.meta }
}

export async function getPayment(id: string): Promise<Payment> {
  const { data } = await apiClient.get<ApiSuccess<Payment>>(`/v1/payments/${id}`)
  return data.data
}

/** Drives the Fake Payment Gateway's own test-checkout action, proxied
 * through the backend (POST /v1/payments/:id/simulate) -- this panel
 * never calls the gateway itself. The gateway's real signed webhook is
 * what actually completes the payment; this only kicks that off. */
export async function simulatePayment(
  id: string,
  outcome: "SUCCESS" | "FAILED"
): Promise<Payment> {
  const { data } = await apiClient.post<ApiSuccess<Payment>>(
    `/v1/payments/${id}/simulate`,
    { outcome }
  )
  return data.data
}
