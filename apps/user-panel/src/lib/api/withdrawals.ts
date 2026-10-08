import { apiClient } from "./client"
import type { ApiSuccess } from "./types"

/** Mirrors apps/backend's withdrawal.service.ts WithdrawalResponse exactly. */
export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface Withdrawal {
  id: string
  amount: number
  status: WithdrawalStatus
  requestedAt: string
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
