import { apiClient } from "./client"
import type { ApiSuccess } from "./types"

/** Mirrors apps/backend's admin-transfer.service.ts reverseTransfer()
 * response shape -- keep in sync with the backend if it changes.
 *
 * PayLedger's backend only exposes POST /admin/transfers/:id/reverse --
 * there is no admin transfer list/detail GET endpoint yet, so this is
 * the only admin transfer API this panel can integrate with. */
export type TransferStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED"

export interface ReversedTransfer {
  transferId: string
  reversalTransactionId: string
  referenceId: string
  status: TransferStatus
  processedAt: string | null
}

export async function reverseTransfer(id: string): Promise<ReversedTransfer> {
  const { data } = await apiClient.post<ApiSuccess<ReversedTransfer>>(
    `/v1/admin/transfers/${id}/reverse`
  )
  return data.data
}
