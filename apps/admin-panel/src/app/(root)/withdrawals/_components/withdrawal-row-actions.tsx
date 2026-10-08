"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

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
import { Textarea } from "@/components/ui/textarea"
import { getApiErrorMessage } from "@/lib/api/error-message"
import type { WithdrawalListItem } from "@/lib/api/withdrawals"
import { useApproveWithdrawal, useRejectWithdrawal } from "@/hooks/use-withdrawals"

const MIN_REASON_LENGTH = 3

export function WithdrawalRowActions({
  withdrawal,
}: {
  withdrawal: WithdrawalListItem
}) {
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")

  const approveMutation = useApproveWithdrawal()
  const rejectMutation = useRejectWithdrawal()

  if (withdrawal.status !== "PENDING") {
    return null
  }

  const handleApprove = () => {
    approveMutation.mutate(withdrawal.id, {
      onSuccess: () => {
        toast.success(`Withdrawal approved for ${withdrawal.user.name}`)
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, "Failed to approve withdrawal"))
      },
    })
  }

  const handleReject = () => {
    rejectMutation.mutate(
      { id: withdrawal.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(`Withdrawal rejected for ${withdrawal.user.name}`)
          setRejectOpen(false)
          setReason("")
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error, "Failed to reject withdrawal"))
        },
      }
    )
  }

  const reasonTooShort = reason.trim().length > 0 && reason.trim().length < MIN_REASON_LENGTH

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        size="sm"
        variant="default"
        disabled={approveMutation.isPending || rejectMutation.isPending}
        onClick={handleApprove}
      >
        {approveMutation.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          "Approve"
        )}
      </Button>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open)
          if (!open) setReason("")
        }}
      >
        <Button
          size="sm"
          variant="destructive"
          disabled={approveMutation.isPending || rejectMutation.isPending}
          onClick={() => setRejectOpen(true)}
        >
          Reject
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject withdrawal</DialogTitle>
            <DialogDescription>
              Rejecting {withdrawal.user.name}&apos;s withdrawal releases the held
              amount back to their available balance. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (minimum 3 characters)"
            rows={3}
            autoFocus
          />
          {reasonTooShort && (
            <p className="text-xs text-destructive">
              Reason must be at least {MIN_REASON_LENGTH} characters.
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              disabled={
                reason.trim().length < MIN_REASON_LENGTH || rejectMutation.isPending
              }
              onClick={handleReject}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Confirm rejection"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
