"use client"

import * as React from "react"
import { Receipt } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pagination } from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TransactionDetailDialog } from "@/components/transaction-detail-dialog"
import { TransactionRow } from "@/components/transaction-row"
import { useTransactionsQuery } from "@/hooks/use-transactions"
import { getApiErrorMessage } from "@/lib/api/error-message"
import type { TransactionStatus, TransactionType } from "@/lib/api/transactions"
import { formatInr } from "@/lib/money"
import { computeSerial } from "@/lib/pagination"
import { transactionStatusTone } from "@/lib/status"

const PAGE_SIZE = 20

const TYPE_OPTIONS: { value: TransactionType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All types" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "TRANSFER_REVERSAL", label: "Reversal" },
  { value: "WITHDRAWAL", label: "Withdrawal" },
]

const STATUS_OPTIONS: { value: TransactionStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "REVERSED", label: "Reversed" },
]

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default function TransactionsPage() {
  const [page, setPage] = React.useState(1)
  const [type, setType] = React.useState<TransactionType | "ALL">("ALL")
  const [status, setStatus] = React.useState<TransactionStatus | "ALL">("ALL")
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const { data, isLoading, isError, error, isFetching } = useTransactionsQuery({
    page,
    limit: PAGE_SIZE,
    type: type === "ALL" ? undefined : type,
    status: status === "ALL" ? undefined : status,
    from: from || undefined,
    to: to || undefined,
  })

  const items = data?.items ?? []
  const meta = data?.meta

  const resetToFirstPage = () => setPage(1)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Receipt}
        title="Transactions"
        description="Every deposit, transfer, and withdrawal on your account."
        tint="slate"
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select
                value={type}
                onValueChange={(value) => {
                  setType(value as TransactionType | "ALL")
                  resetToFirstPage()
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value as TransactionStatus | "ALL")
                  resetToFirstPage()
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value)
                  resetToFirstPage()
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value)
                  resetToFirstPage()
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertDescription>{getApiErrorMessage(error, "Failed to load transactions")}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Receipt className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground">
              Your deposits, transfers, and withdrawals will show up here.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && items.length > 0 && (
        <>
          {/* Desktop/tablet: table */}
          <Card className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">SN</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((txn, index) => (
                  <TableRow
                    key={txn.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(txn.id)}
                  >
                    <TableCell className="text-muted-foreground">
                      {computeSerial(page, PAGE_SIZE, index)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">{txn.type.replace("_", " ")}</p>
                      {txn.counterparty && (
                        <p className="text-xs text-muted-foreground">
                          {txn.direction === "DEBIT" ? "to" : "from"} {txn.counterparty.name}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(txn.createdAt)}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={transactionStatusTone(txn.status)}>{txn.status}</StatusPill>
                    </TableCell>
                    <TableCell
                      className={
                        txn.direction === "CREDIT"
                          ? "text-right font-mono font-medium text-success"
                          : "text-right font-mono font-medium text-foreground"
                      }
                    >
                      {txn.direction === "CREDIT" ? "+" : "−"}
                      {formatInr(txn.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: compact row list */}
          <Card className="flex flex-col gap-1 p-2 sm:hidden">
            {items.map((txn) => (
              <TransactionRow key={txn.id} transaction={txn} onClick={() => setSelectedId(txn.id)} />
            ))}
          </Card>
        </>
      )}

      {meta && meta.totalPages > 1 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          hasNextPage={meta.hasNextPage}
          hasPreviousPage={meta.hasPreviousPage}
          onPageChange={setPage}
          disabled={isFetching}
        />
      )}

      <TransactionDetailDialog
        transactionId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </div>
  )
}
