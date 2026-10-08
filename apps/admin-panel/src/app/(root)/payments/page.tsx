"use client"

import * as React from "react"
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
import { usePaymentsQuery } from "@/hooks/use-payments"
import { getApiErrorMessage } from "@/lib/api/error-message"
import type { PaymentStatus } from "@/lib/api/payments"
import { computeSerial } from "@/lib/pagination"
import { paymentStatusLabel, paymentStatusVariant } from "@/lib/payments/status"

import { PaymentDetailSheet } from "./_components/payment-detail-sheet"

const PAGE_SIZE = 20

type StatusFilter = "ALL" | PaymentStatus

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "CREATED", label: "Created" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SUCCESS", label: "Success" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "EXPIRED", label: "Expired" },
]

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default function PaymentsPage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<StatusFilter>("ALL")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  const { data, isLoading, isFetching, isError, error, refetch } = usePaymentsQuery({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status === "ALL" ? undefined : status,
  })

  const items = data?.items ?? []
  const meta = data?.meta

  return (
    <PageLayout
      title="Payments"
      description="All deposit/payment orders across every user."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search order ID, user"
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
              <TableHead>Order ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Paid at</TableHead>
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
                    icon={Landmark}
                    title="No payments found"
                    description="There are no payments matching this filter."
                  />
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              items.map((payment, index) => (
                <TableRow
                  key={payment.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(payment.id)}
                >
                  <TableCell className="text-muted-foreground text-center">
                    {computeSerial(page, PAGE_SIZE, index)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{payment.orderId}</TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{payment.user.name}</p>
                    <p className="text-xs text-muted-foreground">{payment.user.mobile}</p>
                  </TableCell>
                  <TableCell>{formatAmount(payment.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge variant={paymentStatusVariant(payment.status)}>
                      {paymentStatusLabel(payment.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(payment.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(payment.paidAt)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {isError && (
          <EmptyState
            icon={Landmark}
            title="Failed to load payments"
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

      <PaymentDetailSheet
        paymentId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </PageLayout>
  )
}
