import { apiClient } from "./client"
import type { ApiSuccess } from "./types"

/** Mirrors apps/backend's transfer.service.ts response shapes exactly. */
export type TransferStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED"

export interface RecipientSummary {
  userId: string
  name: string
}

export interface Transfer {
  id: string
  referenceId: string
  recipient: RecipientSummary
  amount: number
  fee: number
  total: number
  status: TransferStatus
  createdAt: string
}

export async function lookupRecipient(mobile: string): Promise<RecipientSummary> {
  const { data } = await apiClient.post<ApiSuccess<RecipientSummary>>(
    "/v1/transfers/recipient",
    { mobile }
  )
  return data.data
}

export async function createTransfer(
  recipientUserId: string,
  amount: number,
  idempotencyKey: string
): Promise<Transfer> {
  const { data } = await apiClient.post<ApiSuccess<Transfer>>(
    "/v1/transfers",
    { recipientUserId, amount },
    { headers: { "Idempotency-Key": idempotencyKey } }
  )
  return data.data
}
