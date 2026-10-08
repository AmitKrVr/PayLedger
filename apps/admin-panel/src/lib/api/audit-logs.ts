import { apiClient } from "./client"
import type { ApiPaginatedSuccess, PaginationMeta } from "./types"

export type AuditActorType = "USER" | "ADMIN" | "SYSTEM"
export type AuditStatus = "SUCCESS" | "FAILURE"

export interface AuditLogActor {
  type: AuditActorType
  name: string | null
  detail: string | null
}

export interface AuditLogItem {
  id: string
  actor: AuditLogActor
  action: string
  status: AuditStatus
  targetType: string
  targetId: string | null
  metadata: Record<string, unknown> | null
  requestId: string | null
  createdAt: string
}

export interface ListAuditLogsParams {
  page: number
  limit: number
  search?: string
  action?: string
  adminId?: string
  targetType?: string
  from?: string
  to?: string
}

export async function listAuditLogs(
  params: ListAuditLogsParams
): Promise<{ items: AuditLogItem[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiPaginatedSuccess<AuditLogItem>>(
    "/v1/admin/audit-logs",
    { params }
  )
  return { items: data.data, meta: data.meta }
}
