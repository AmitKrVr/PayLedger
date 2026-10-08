import { apiClient } from "./client"
import type { ApiSuccess } from "./types"

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
  expiresAt: string | null
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

export async function getPayment(id: string): Promise<Payment> {
  const { data } = await apiClient.get<ApiSuccess<Payment>>(`/v1/payments/${id}`)
  return data.data
}
