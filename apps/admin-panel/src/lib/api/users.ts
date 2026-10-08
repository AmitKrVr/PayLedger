import { apiClient } from "./client"
import type { ApiPaginatedSuccess, ApiSuccess, PaginationMeta } from "./types"

export type UserStatus = "PENDING" | "ACTIVE" | "BLOCKED"
export type WalletStatus = "ACTIVE" | "BLOCKED"

export interface WalletSummary {
  status: WalletStatus
  balance: number
  held: number
  available: number
}

export interface UserListItem {
  id: string
  name: string
  mobile: string
  email: string | null
  status: UserStatus
  createdAt: string
  wallet: WalletSummary | null
}

export interface UserDetail extends UserListItem {
  lastLoginAt: string | null
  recentTransactions: {
    id: string
    reference: string
    type: string
    status: string
    createdAt: string
  }[]
  recentPayments: {
    id: string
    orderId: string
    amount: number
    status: string
    createdAt: string
  }[]
  recentWithdrawals: {
    id: string
    amount: number
    status: string
    requestedAt: string
  }[]
}

export interface ListUsersParams {
  page: number
  limit: number
  search?: string
  status?: UserStatus
  walletStatus?: WalletStatus
  from?: string
  to?: string
  sort?: "newest" | "oldest"
}

export async function listUsers(
  params: ListUsersParams
): Promise<{ items: UserListItem[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiPaginatedSuccess<UserListItem>>(
    "/v1/admin/users",
    { params }
  )
  return { items: data.data, meta: data.meta }
}

export async function getUser(id: string): Promise<UserDetail> {
  const { data } = await apiClient.get<ApiSuccess<UserDetail>>(`/v1/admin/users/${id}`)
  return data.data
}
