"use client"

import * as React from "react"
import { ScrollText } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageLayout } from "@/components/page-layout"
import { RefreshButton } from "@/components/refresh-button"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuditLogsQuery } from "@/hooks/use-audit-logs"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { computeSerial } from "@/lib/pagination"

const PAGE_SIZE = 20

const ACTION_OPTIONS = [
  { value: "ALL", label: "All actions" },
  { value: "USER_LOGIN", label: "User login" },
  { value: "USER_REGISTER", label: "User register" },
  { value: "ADMIN_LOGIN", label: "Admin login" },
  { value: "ADMIN_LOGOUT", label: "Admin logout" },
  { value: "TOKEN_REFRESH", label: "Token refresh" },
  { value: "WITHDRAWAL_APPROVED", label: "Withdrawal approved" },
  { value: "WITHDRAWAL_REJECTED", label: "Withdrawal rejected" },
  { value: "TRANSFER_REVERSED", label: "Transfer reversed" },
]

const TARGET_TYPE_OPTIONS = [
  { value: "ALL", label: "All targets" },
  { value: "USER", label: "User" },
  { value: "ADMIN", label: "Admin" },
  { value: "SESSION", label: "Session" },
  { value: "WITHDRAWAL", label: "Withdrawal" },
  { value: "TRANSFER", label: "Transfer" },
]

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default function AuditLogsPage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [action, setAction] = React.useState("ALL")
  const [targetType, setTargetType] = React.useState("ALL")
  const debouncedSearch = useDebouncedValue(search)

  const { data, isLoading, isFetching, isError, error, refetch } = useAuditLogsQuery({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    action: action === "ALL" ? undefined : action,
    targetType: targetType === "ALL" ? undefined : targetType,
  })

  const items = data?.items ?? []
  const meta = data?.meta

  return (
    <PageLayout
      title="Audit Logs"
      description="A read-only trail of admin and account actions."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search admin, target ID"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-56"
          />
          <Select
            value={action}
            onValueChange={(value) => {
              setAction(value ?? "ALL")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={targetType}
            onValueChange={(value) => {
              setTargetType(value ?? "ALL")
              setPage(1)
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <RefreshButton isRefreshing={isFetching && !isLoading} onClick={() => refetch()} />
        </div>
      }
    >
      <div className="rounded-sm border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">SN</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 6 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && !isError && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={ScrollText}
                    title="No audit log entries found"
                    description="There are no entries matching this filter."
                  />
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              items.map((log, index) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground text-center">
                    {computeSerial(page, PAGE_SIZE, index)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{log.actor.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.actor.type}
                      {log.actor.detail ? ` · ${log.actor.detail}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.action}</TableCell>
                  <TableCell>
                    <p className="text-foreground">{log.targetType}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={log.status === "SUCCESS" ? "success" : "danger"}>
                      {log.status}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {isError && (
          <EmptyState
            icon={ScrollText}
            title="Failed to load audit logs"
            description={getApiErrorMessage(error)}
          />
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {meta.page} of {meta.totalPages} · {meta.totalItems} total
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!meta.hasPreviousPage || isFetching}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!meta.hasNextPage || isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
