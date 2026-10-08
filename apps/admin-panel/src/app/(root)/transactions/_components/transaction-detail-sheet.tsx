"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTransactionQuery } from "@/hooks/use-transactions"
import { getApiErrorMessage } from "@/lib/api/error-message"
import {
  transactionStatusLabel,
  transactionStatusVariant,
  transactionTypeLabel,
} from "@/lib/transactions/status"

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export function TransactionDetailSheet({
  transactionId,
  onOpenChange,
}: {
  transactionId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const { data: txn, isLoading, isError, error } = useTransactionQuery(transactionId)

  return (
    <Sheet open={transactionId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Transaction detail</SheetTitle>
          <SheetDescription>
            {txn ? `Reference ${txn.reference}` : "Loading transaction details"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-64 flex-col gap-3 px-4 pb-4 text-sm">
          {isLoading && (
            <>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </>
          )}

          {isError && (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(error, "Failed to load transaction")}
            </p>
          )}

          {txn && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium text-foreground">
                  {transactionTypeLabel(txn.type)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">User</span>
                <span className="truncate font-medium text-foreground">{txn.user.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span
                  className={
                    txn.direction === "CREDIT"
                      ? "font-semibold text-emerald-600"
                      : "font-semibold text-foreground"
                  }
                >
                  {txn.direction === "CREDIT" ? "+" : "−"}
                  {formatAmount(txn.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge variant={transactionStatusVariant(txn.status)}>
                  {transactionStatusLabel(txn.status)}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">{formatDate(txn.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span className="text-foreground">{formatDate(txn.completedAt)}</span>
              </div>

              <div className="mt-2">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Ledger entries
                </p>
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Wallet</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {txn.ledgerEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.wallet}</TableCell>
                          <TableCell>
                            <StatusBadge
                              variant={entry.direction === "CREDIT" ? "success" : "neutral"}
                            >
                              {entry.direction}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(entry.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
