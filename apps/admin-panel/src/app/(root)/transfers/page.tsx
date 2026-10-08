"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PageLayout } from "@/components/page-layout"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useReverseTransfer } from "@/hooks/use-transfers"
import { getApiErrorMessage } from "@/lib/api/error-message"
import type { ReversedTransfer } from "@/lib/api/transfers"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default function TransfersPage() {
  const [transferId, setTransferId] = React.useState("")
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [result, setResult] = React.useState<ReversedTransfer | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)

  const reverseMutation = useReverseTransfer()

  const isValidId = UUID_PATTERN.test(transferId.trim())

  const handleReverse = () => {
    reverseMutation.mutate(transferId.trim(), {
      onSuccess: (reversed) => {
        setResult(reversed)
        setConfirmOpen(false)
        toast.success("Transfer reversed successfully")
      },
      onError: (error) => {
        setConfirmOpen(false)
        setFormError(getApiErrorMessage(error, "Failed to reverse transfer"))
      },
    })
  }

  const startOver = () => {
    setResult(null)
    setTransferId("")
    setFormError(null)
  }

  return (
    <PageLayout
      title="Transfers"
      description="Reverse a completed transfer by its transfer ID."
    >
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Reverse a transfer</CardTitle>
          <CardDescription>
            PayLedger does not yet expose an admin transfer list/detail API --
            only reversal. Enter the internal transfer ID (obtained from
            support tooling or the database) to reverse it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!result ? (
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="transfer-id">Transfer ID</FieldLabel>
                <Input
                  id="transfer-id"
                  placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
                  value={transferId}
                  onChange={(e) => {
                    setTransferId(e.target.value)
                    setFormError(null)
                  }}
                />
                <FieldDescription>
                  This must be the transfer&apos;s internal UUID, not its reference ID.
                </FieldDescription>
                <FieldError>{formError}</FieldError>
              </Field>

              <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <Button
                  variant="destructive"
                  disabled={!isValidId}
                  onClick={() => setConfirmOpen(true)}
                  className="self-start"
                >
                  Reverse transfer
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reverse this transfer?</DialogTitle>
                    <DialogDescription>
                      This is a financial operation: the receiver will be
                      debited and the original sender credited the full
                      transfer amount. It cannot be undone, and a transfer
                      can only be reversed once.
                    </DialogDescription>
                  </DialogHeader>
                  <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground break-all">
                    {transferId.trim()}
                  </p>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                      Cancel
                    </DialogClose>
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
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge variant="success">{result.status}</StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Reversal reference</span>
                <span className="font-mono text-xs text-foreground">{result.referenceId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Processed at</span>
                <span className="text-foreground">{formatDate(result.processedAt)}</span>
              </div>
              <Button variant="outline" className="mt-2 self-start" onClick={startOver}>
                Reverse another transfer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
