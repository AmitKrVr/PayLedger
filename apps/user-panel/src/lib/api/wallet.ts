import { apiClient } from "./client"
import type { ApiSuccess } from "./types"

/** Mirrors apps/backend's wallet.types.ts WalletResponse exactly. */
export type WalletStatus = "ACTIVE" | "BLOCKED"

export interface Wallet {
  id: string
  balance: number
  held: number
  available: number
  status: WalletStatus
}

export async function getWallet(): Promise<Wallet> {
  const { data } = await apiClient.get<ApiSuccess<Wallet>>("/v1/wallet")
  return data.data
}
