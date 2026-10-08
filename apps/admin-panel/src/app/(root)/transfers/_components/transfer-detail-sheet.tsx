"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/status-badge"
import { useReverseTransfer, useTransferQuery } from "@/hooks/use-transfers"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { transferStatusLabel, transferStatusVariant } from "@/lib/transfers/status"

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export function TransferDetailSheet({
  transferId,
  onOpenChange,
}: {
  transferId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const { data: transfer, isLoading, isError, error } = useTransferQuery(transferId)
  const reverseMutation = useReverseTransfer()

  const handleReverse = () => {
    if (!transferId) return

    reverseMutation.mutate(transferId, {
      onSuccess: () => {
        setConfirmOpen(false)
        toast.success("Transfer reversed successfully")
      },
      onError: (err) => {
        setConfirmOpen(false)
        toast.error(getApiErrorMessage(err, "Failed to reverse transfer"))
      },
    })
  }

  const canReverse = transfer?.status === "COMPLETED"

  return (
    <Sheet open={transferId !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Transfer detail</SheetTitle>
          <SheetDescription>
            {transfer ? `Reference ${transfer.reference}` : "Loading transfer details"}
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
              {getApiErrorMessage(error, "Failed to load transfer")}
            </p>
          )}

          {transfer && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">Sender</span>
                <span className="truncate font-medium text-foreground">{transfer.sender.name}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">Recipient</span>
                <span className="truncate font-medium text-foreground">{transfer.recipient.name}</span>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-foreground">{formatAmount(transfer.amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span className="text-foreground">{formatAmount(transfer.fee)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total debited</span>
                <span className="font-semibold text-foreground">
                  {formatAmount(transfer.total)}
                </span>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge variant={transferStatusVariant(transfer.status)}>
                  {transferStatusLabel(transfer.status)}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">{formatDate(transfer.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span className="text-foreground">{formatDate(transfer.completedAt)}</span>
              </div>

              {transfer.status === "REVERSED" && (
                <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Reversed {formatDate(transfer.reversedAt)}
                  </span>
                  {transfer.reversalReference && (
                    <span className="font-mono text-xs text-foreground">
                      Reversal reference {transfer.reversalReference}
                    </span>
                  )}
                </div>
              )}

              {!canReverse && transfer.status !== "REVERSED" && (
                <p className="text-xs text-muted-foreground">
                  Only completed transfers can be reversed. This transfer is {transfer.status.toLowerCase()}.
                </p>
              )}
            </>
          )}
        </div>

        {canReverse && (
          <SheetFooter>
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                Reverse transfer
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reverse this transfer?</DialogTitle>
                  <DialogDescription>
                    This is a financial operation. {transfer?.recipient.name} will be debited
                    and {transfer?.sender.name} will be credited{" "}
                    {transfer ? formatAmount(transfer.amount) : ""} back. The fee is not
                    refunded. This creates a new reversal transaction and cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 text-muted-foreground">Sender (receives back)</span>
                    <span className="truncate font-medium text-foreground">{transfer?.sender.name}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 text-muted-foreground">Recipient (debited)</span>
                    <span className="truncate font-medium text-foreground">
                      {transfer?.recipient.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold text-foreground">
                      {transfer ? formatAmount(transfer.amount) : ""}
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <Button
                    variant="destructive"
                    disabled={reverseMutation.isPending}
                    onClick={handleReverse}
                  >
                    {reverseMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      "Confirm reversal"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
