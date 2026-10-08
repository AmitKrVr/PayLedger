import { apiClient } from "./client"
import type { ApiSuccess } from "./types"
import type { PaymentListItem } from "./payments"
import type { WithdrawalListItem } from "./withdrawals"

export interface DashboardTransferItem {
  id: string
  reference: string
  sender: { id: string; name: string; mobile: string }
  recipient: { id: string; name: string; mobile: string }
  amount: number
  status: string
  createdAt: string
}

export interface DashboardStats {
  totalUsers: number
  totalWalletBalance: number
  pendingWithdrawals: { count: number; amount: number }
  pendingPayments: number
  todaysDeposits: { count: number; amount: number }
  todaysTransfers: { count: number; amount: number }
}

export interface Dashboard {
  stats: DashboardStats
  recentPayments: PaymentListItem[]
  recentTransfers: DashboardTransferItem[]
  recentWithdrawals: WithdrawalListItem[]
}

export async function getDashboard(): Promise<Dashboard> {
  const { data } = await apiClient.get<ApiSuccess<Dashboard>>("/v1/admin/dashboard")
  return data.data
}
