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
import { useWithdrawalQuery } from "@/hooks/use-withdrawals"
import { getApiErrorMessage } from "@/lib/api/error-message"
import {
  withdrawalStatusLabel,
  withdrawalStatusVariant,
} from "@/lib/withdrawals/status"

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

export function WithdrawalDetailSheet({
  withdrawalId,
  onOpenChange,
}: {
  withdrawalId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const { data: withdrawal, isLoading, isError, error } = useWithdrawalQuery(withdrawalId)

  return (
    <Sheet open={withdrawalId !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Withdrawal detail</SheetTitle>
          <SheetDescription>
            {withdrawal ? `ID ${withdrawal.id}` : "Loading withdrawal details"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
          {isLoading && (
            <>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </>
          )}

          {isError && (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(error, "Failed to load withdrawal")}
            </p>
          )}

          {withdrawal && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">User</span>
                <span className="font-medium text-foreground">{withdrawal.user.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mobile</span>
                <span className="text-foreground">{withdrawal.user.mobile}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold text-foreground">
                  {formatAmount(withdrawal.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge variant={withdrawalStatusVariant(withdrawal.status)}>
                  {withdrawalStatusLabel(withdrawal.status)}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Requested</span>
                <span className="text-foreground">{formatDate(withdrawal.requestedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Processed</span>
                <span className="text-foreground">{formatDate(withdrawal.processedAt)}</span>
              </div>
              {withdrawal.processedByAdminId && (
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0 text-muted-foreground">Processed by</span>
                  <span className="truncate font-mono text-xs text-foreground">
                    {withdrawal.processedByAdminId}
                  </span>
                </div>
              )}
              {withdrawal.rejectionReason && (
                <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Rejection reason
                  </span>
                  <span className="text-foreground">{withdrawal.rejectionReason}</span>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
