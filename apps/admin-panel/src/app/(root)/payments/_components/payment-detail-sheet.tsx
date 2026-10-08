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
import { usePaymentQuery } from "@/hooks/use-payments"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { paymentStatusLabel, paymentStatusVariant } from "@/lib/payments/status"

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export function PaymentDetailSheet({
  paymentId,
  onOpenChange,
}: {
  paymentId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const { data: payment, isLoading, isError, error } = usePaymentQuery(paymentId)

  return (
    <Sheet open={paymentId !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Payment detail</SheetTitle>
          <SheetDescription>
            {payment ? `Order ${payment.orderId}` : "Loading payment details"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-48 flex-col gap-3 px-4 pb-4 text-sm">
          {isLoading && (
            <>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </>
          )}

          {isError && (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(error, "Failed to load payment")}
            </p>
          )}

          {payment && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">User</span>
                <span className="truncate font-medium text-foreground">{payment.user.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mobile</span>
                <span className="text-foreground">{payment.user.mobile}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold text-foreground">
                  {formatAmount(payment.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge variant={paymentStatusVariant(payment.status)}>
                  {paymentStatusLabel(payment.status)}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Provider</span>
                <span className="text-foreground">{payment.provider}</span>
              </div>
              {payment.paymentId && (
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0 text-muted-foreground">Gateway payment ID</span>
                  <span className="truncate font-mono text-xs text-foreground">
                    {payment.paymentId}
                  </span>
                </div>
              )}
              {payment.failureReason && (
                <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Failure reason
                  </span>
                  <span className="text-foreground">{payment.failureReason}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">{formatDate(payment.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Paid at</span>
                <span className="text-foreground">{formatDate(payment.paidAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Expires at</span>
                <span className="text-foreground">{formatDate(payment.expiresAt)}</span>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
