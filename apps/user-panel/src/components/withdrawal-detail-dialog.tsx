"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { useWithdrawalQuery } from "@/hooks/use-withdrawals"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { formatInr } from "@/lib/money"
import { withdrawalStatusTone } from "@/lib/status"

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function WithdrawalDetailDialog({
  withdrawalId,
  onOpenChange,
}: {
  withdrawalId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const { data: withdrawal, isLoading, isError, error } = useWithdrawalQuery(withdrawalId)

  return (
    <Dialog open={withdrawalId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdrawal detail</DialogTitle>
          <DialogDescription>
            {withdrawal ? `Requested ${formatDateTime(withdrawal.createdAt)}` : "Loading withdrawal details"}
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
              {getApiErrorMessage(error, "Failed to load withdrawal")}
            </AlertDescription>
          </Alert>
        )}

        {withdrawal && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold text-foreground">{formatInr(withdrawal.amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusPill tone={withdrawalStatusTone(withdrawal.status)}>
                {withdrawal.status}
              </StatusPill>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Requested</span>
              <span className="text-foreground">{formatDateTime(withdrawal.createdAt)}</span>
            </div>
            {withdrawal.processedAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Processed</span>
                <span className="text-foreground">{formatDateTime(withdrawal.processedAt)}</span>
              </div>
            )}
            {withdrawal.reference && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-mono text-xs text-foreground">{withdrawal.reference}</span>
              </div>
            )}
            {withdrawal.rejectionReason && (
              <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
                <span className="text-xs font-medium text-muted-foreground">Rejection reason</span>
                <span className="text-foreground">{withdrawal.rejectionReason}</span>
              </div>
            )}
            {withdrawal.status === "PENDING" && (
              <p className="text-xs text-muted-foreground">
                This request is held and awaiting review by our team.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
