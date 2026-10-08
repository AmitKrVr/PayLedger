import { apiClient } from "./client"
import type { ApiSuccess } from "./types"

/** Mirrors apps/backend's config.service.ts LimitsResponse exactly. */
export interface Limits {
  payment: { minAmount: number; maxAmount: number }
  withdrawal: { minAmount: number; maxAmount: number }
  transfer: {
    maxAmount: number
    dailyLimit: number
    feePercent: number
    feeMinAmount: number
    feeMaxAmount: number
  }
}

export async function getLimits(): Promise<Limits> {
  const { data } = await apiClient.get<ApiSuccess<Limits>>("/v1/config/limits")
  return data.data
}
