"use client"

import * as React from "react"
import { ArrowLeftRight } from "lucide-react"

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
import { useTransfersQuery } from "@/hooks/use-transfers"
import { getApiErrorMessage } from "@/lib/api/error-message"
import type { TransferStatus } from "@/lib/api/transfers"
import { computeSerial } from "@/lib/pagination"
import { transferStatusLabel, transferStatusVariant } from "@/lib/transfers/status"

import { TransferDetailSheet } from "./_components/transfer-detail-sheet"

const PAGE_SIZE = 20

type StatusFilter = "ALL" | TransferStatus

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "REVERSED", label: "Reversed" },
]

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default function TransfersPage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<StatusFilter>("ALL")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  const { data, isLoading, isFetching, isError, error, refetch } = useTransfersQuery({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status === "ALL" ? undefined : status,
  })

  const items = data?.items ?? []
  const meta = data?.meta

  return (
    <PageLayout
      title="Transfers"
      description="Inspect transfers and reverse a completed one."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search reference, sender, recipient"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-64"
          />
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-36">
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
              <TableHead>Sender</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 8 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && !isError && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <EmptyState
                    icon={ArrowLeftRight}
                    title="No transfers found"
                    description="There are no transfers matching this filter."
                  />
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              items.map((transfer, index) => (
                <TableRow
                  key={transfer.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(transfer.id)}
                >
                  <TableCell className="text-muted-foreground text-center">
                    {computeSerial(page, PAGE_SIZE, index)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{transfer.reference}</TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{transfer.sender.name}</p>
                    <p className="text-xs text-muted-foreground">{transfer.sender.mobile}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{transfer.recipient.name}</p>
                    <p className="text-xs text-muted-foreground">{transfer.recipient.mobile}</p>
                  </TableCell>
                  <TableCell>{formatAmount(transfer.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatAmount(transfer.fee)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={transferStatusVariant(transfer.status)}>
                      {transferStatusLabel(transfer.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(transfer.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {isError && (
          <EmptyState
            icon={ArrowLeftRight}
            title="Failed to load transfers"
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

      <TransferDetailSheet
        transferId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </PageLayout>
  )
}
