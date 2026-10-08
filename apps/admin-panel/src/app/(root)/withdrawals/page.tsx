"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Landmark } from "lucide-react"

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
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useWithdrawalsQuery } from "@/hooks/use-withdrawals"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { computeSerial } from "@/lib/pagination"
import type { WithdrawalStatus } from "@/lib/api/withdrawals"
import {
  withdrawalStatusLabel,
  withdrawalStatusVariant,
} from "@/lib/withdrawals/status"

import { WithdrawalDetailSheet } from "./_components/withdrawal-detail-sheet"
import { WithdrawalRowActions } from "./_components/withdrawal-row-actions"

const PAGE_SIZE = 20

type StatusFilter = "ALL" | WithdrawalStatus

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
]

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`
}

export default function WithdrawalsPage() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get("status")

  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<StatusFilter>(
    initialStatus === "PENDING" || initialStatus === "APPROVED" || initialStatus === "REJECTED"
      ? initialStatus
      : "ALL"
  )
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  const { data, isLoading, isFetching, isError, error, refetch } = useWithdrawalsQuery({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status === "ALL" ? undefined : status,
  })

  const items = data?.items ?? []
  const meta = data?.meta

  return (
    <PageLayout
      title="Withdrawals"
      description="Review and process user withdrawal requests."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search reference, user, mobile"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-56"
          />
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((option) => (
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
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">SN</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Processed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 9 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && !isError && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <EmptyState
                    icon={Landmark}
                    title="No withdrawals found"
                    description="There are no withdrawal requests matching this filter."
                  />
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              items.map((withdrawal, index) => (
                <TableRow key={withdrawal.id}>
                  <TableCell className="text-muted-foreground text-center">
                    {computeSerial(page, PAGE_SIZE, index)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {withdrawal.reference ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">{withdrawal.user.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {withdrawal.user.mobile}
                  </TableCell>
                  <TableCell>{formatAmount(withdrawal.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge variant={withdrawalStatusVariant(withdrawal.status)}>
                      {withdrawalStatusLabel(withdrawal.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(withdrawal.requestedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(withdrawal.processedAt)}
                  </TableCell>
                  <TableCell>
                    <WithdrawalRowActions
                      withdrawal={withdrawal}
                      onView={() => setDetailId(withdrawal.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {isError && (
          <EmptyState
            icon={Landmark}
            title="Failed to load withdrawals"
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

      <WithdrawalDetailSheet
        withdrawalId={detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
      />
    </PageLayout>
  )
}
