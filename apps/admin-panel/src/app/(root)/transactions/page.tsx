"use client"

import * as React from "react"
import { Receipt } from "lucide-react"

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
import { useTransactionsQuery } from "@/hooks/use-transactions"
import { getApiErrorMessage } from "@/lib/api/error-message"
import type { TransactionStatus, TransactionType } from "@/lib/api/transactions"
import { computeSerial } from "@/lib/pagination"
import {
  transactionStatusLabel,
  transactionStatusVariant,
  transactionTypeLabel,
} from "@/lib/transactions/status"

import { TransactionDetailSheet } from "./_components/transaction-detail-sheet"

const PAGE_SIZE = 20

type TypeFilter = "ALL" | TransactionType
type StatusFilter = "ALL" | TransactionStatus

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "ALL", label: "All types" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "TRANSFER_REVERSAL", label: "Reversal" },
  { value: "WITHDRAWAL", label: "Withdrawal" },
]

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

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default function TransactionsPage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [type, setType] = React.useState<TypeFilter>("ALL")
  const [status, setStatus] = React.useState<StatusFilter>("ALL")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  const { data, isLoading, isFetching, isError, error, refetch } = useTransactionsQuery({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    type: type === "ALL" ? undefined : type,
    status: status === "ALL" ? undefined : status,
  })

  const items = data?.items ?? []
  const meta = data?.meta

  const resetPage = () => setPage(1)

  return (
    <PageLayout
      title="Transactions"
      description="Every financial transaction across the platform (read-only)."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search reference, user"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              resetPage()
            }}
            className="w-56"
          />
          <Select
            value={type}
            onValueChange={(value) => {
              setType(value as TypeFilter)
              resetPage()
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter)
              resetPage()
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
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 7 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && !isError && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    icon={Receipt}
                    title="No transactions found"
                    description="There are no transactions matching this filter."
                  />
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              items.map((txn, index) => (
                <TableRow
                  key={txn.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(txn.id)}
                >
                  <TableCell className="text-muted-foreground text-center">
                    {computeSerial(page, PAGE_SIZE, index)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{txn.reference}</TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{txn.user.name}</p>
                    <p className="text-xs text-muted-foreground">{txn.user.mobile}</p>
                  </TableCell>
                  <TableCell>{transactionTypeLabel(txn.type)}</TableCell>
                  <TableCell
                    className={txn.direction === "CREDIT" ? "text-emerald-600" : "text-foreground"}
                  >
                    {txn.direction === "CREDIT" ? "+" : "−"}
                    {formatAmount(txn.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={transactionStatusVariant(txn.status)}>
                      {transactionStatusLabel(txn.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(txn.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {isError && (
          <EmptyState
            icon={Receipt}
            title="Failed to load transactions"
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

      <TransactionDetailSheet
        transactionId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </PageLayout>
  )
}
