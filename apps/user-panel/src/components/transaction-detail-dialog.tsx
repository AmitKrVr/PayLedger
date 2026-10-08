"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useTransactionQuery } from "@/hooks/use-transactions"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { formatInr } from "@/lib/money"
import { transactionStatusTone } from "@/lib/status"

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

const TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "Add money",
  TRANSFER: "Transfer",
  TRANSFER_REVERSAL: "Transfer reversal",
  WITHDRAWAL: "Withdrawal",
}

export function TransactionDetailDialog({
  transactionId,
  onOpenChange,
}: {
  transactionId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const { data: txn, isLoading, isError, error } = useTransactionQuery(transactionId)

  return (
    <Dialog open={transactionId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transaction detail</DialogTitle>
          <DialogDescription>
            {txn ? `Reference ${txn.referenceId}` : "Loading transaction details"}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {getApiErrorMessage(error, "Failed to load transaction")}
            </AlertDescription>
          </Alert>
        )}

        {txn && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium text-foreground">
                {TYPE_LABEL[txn.type] ?? txn.type}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span
                className={
                  txn.direction === "CREDIT"
                    ? "font-semibold text-success"
                    : "font-semibold text-foreground"
                }
              >
                {txn.direction === "CREDIT" ? "+" : "−"}
                {formatInr(txn.amount)}
              </span>
            </div>
            {txn.counterparty && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {txn.direction === "DEBIT" ? "To" : "From"}
                </span>
                <span className="font-medium text-foreground">{txn.counterparty.name}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusPill tone={transactionStatusTone(txn.status)}>{txn.status}</StatusPill>
            </div>

            <Separator />

            {txn.description && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Description</span>
                <span className="text-foreground">{txn.description}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="text-foreground">{formatDateTime(txn.createdAt)}</span>
            </div>
            {txn.completedAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span className="text-foreground">{formatDateTime(txn.completedAt)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reference ID</span>
              <span className="font-mono text-xs text-foreground">{txn.referenceId}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
