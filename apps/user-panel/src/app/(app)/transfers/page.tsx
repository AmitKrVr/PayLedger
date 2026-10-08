"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { StatusPill } from "@/components/ui/status-pill"
import { useLimitsQuery } from "@/hooks/use-config"
import { useCreateTransfer, useLookupRecipient } from "@/hooks/use-transfers"
import { getApiErrorMessage } from "@/lib/api/error-message"
import type { RecipientSummary, Transfer } from "@/lib/api/transfers"
import { formatInr } from "@/lib/money"
import { transferStatusTone } from "@/lib/status"

type Step = "mobile" | "amount" | "confirm" | "result"

/** Display-only preview of the fee -- the backend recomputes and returns
 * the authoritative fee/total when the transfer is actually submitted. */
function estimateFee(
  amount: number,
  limits: { feePercent: number; feeMinAmount: number; feeMaxAmount: number }
): number {
  const raw = (amount * limits.feePercent) / 100
  return Math.min(Math.max(raw, limits.feeMinAmount), limits.feeMaxAmount)
}

export default function TransfersPage() {
  const [step, setStep] = React.useState<Step>("mobile")
  const [mobile, setMobile] = React.useState("")
  const [amountInput, setAmountInput] = React.useState("")
  const [recipient, setRecipient] = React.useState<RecipientSummary | null>(null)
  const [result, setResult] = React.useState<Transfer | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)

  const queryClient = useQueryClient()
  const { data: limits } = useLimitsQuery()
  const lookupMutation = useLookupRecipient()
  const transferMutation = useCreateTransfer()

  const amount = Number(amountInput)
  const estimatedFee = limits && amount > 0 ? estimateFee(amount, limits.transfer) : null
  const estimatedTotal = estimatedFee !== null ? amount + estimatedFee : null

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!mobile.trim()) {
      setFormError("Enter a mobile number")
      return
    }

    lookupMutation.mutate(mobile.trim(), {
      onSuccess: (found) => {
        setRecipient(found)
        setStep("amount")
      },
      onError: (error) => {
        setFormError(getApiErrorMessage(error, "Could not find that recipient"))
      },
    })
  }

  const handleContinueToConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!amountInput || Number.isNaN(amount) || amount <= 0) {
      setFormError("Enter a valid amount")
      return
    }
    if (limits && amount > limits.transfer.maxAmount) {
      setFormError(`Maximum transfer amount is ${formatInr(limits.transfer.maxAmount)}`)
      return
    }

    setStep("confirm")
  }

  const handleTransfer = () => {
    setFormError(null)
    if (!recipient) return

    transferMutation.mutate(
      { recipientUserId: recipient.userId, amount, idempotencyKey: crypto.randomUUID() },
      {
        onSuccess: (transfer) => {
          setResult(transfer)
          setStep("result")
          if (transfer.status === "COMPLETED") {
            toast.success(`Sent ${formatInr(transfer.amount)} to ${recipient.name}`)
          }
          queryClient.invalidateQueries({ queryKey: ["wallet"] })
          queryClient.invalidateQueries({ queryKey: ["transactions"] })
        },
        onError: (error) => {
          setFormError(getApiErrorMessage(error, "Transfer failed"))
          setStep("amount")
        },
      }
    )
  }

  const startOver = () => {
    setStep("mobile")
    setMobile("")
    setAmountInput("")
    setRecipient(null)
    setResult(null)
    setFormError(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Send Money</h1>

      {step === "mobile" && (
        <Card className="w-full sm:max-w-md">
          <CardHeader>
            <CardTitle>Who are you sending to?</CardTitle>
            <CardDescription>Enter their PayLedger mobile number.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLookup} className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="mobile">Recipient mobile number</FieldLabel>
                <Input
                  id="mobile"
                  type="tel"
                  autoFocus
                  placeholder="10-digit mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
                <FieldError>{formError}</FieldError>
              </Field>
              <Button type="submit" size="lg" isLoading={lookupMutation.isPending}>
                Find recipient
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "amount" && recipient && (
        <Card className="w-full sm:max-w-md">
          <CardHeader>
            <CardTitle>Sending to {recipient.name}</CardTitle>
            <CardDescription>Enter how much to send.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleContinueToConfirm} className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="amount">Amount (INR)</FieldLabel>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  max={limits?.transfer.maxAmount}
                  step="0.01"
                  autoFocus
                  placeholder="e.g. 100"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                />
                {limits && (
                  <p className="text-xs text-muted-foreground">
                    Max {formatInr(limits.transfer.maxAmount)} per transfer · daily limit{" "}
                    {formatInr(limits.transfer.dailyLimit)}
                  </p>
                )}
                <FieldError>{formError}</FieldError>
              </Field>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep("mobile")}>
                  Back
                </Button>
                <Button type="submit" className="flex-1">
                  Review transfer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "confirm" && recipient && (
        <Card className="w-full sm:max-w-md">
          <CardHeader>
            <CardTitle>Confirm transfer</CardTitle>
            <CardDescription>Review before you send.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Recipient</span>
              <span className="font-medium text-foreground">{recipient.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="font-medium text-foreground">{formatInr(amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estimated fee</span>
              <span className="font-medium text-foreground">
                {estimatedFee !== null ? formatInr(estimatedFee) : "—"}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estimated total</span>
              <span className="font-semibold text-foreground">
                {estimatedTotal !== null ? formatInr(estimatedTotal) : "—"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              The fee shown here is an estimate. The exact fee is calculated by PayLedger
              when your transfer is submitted.
            </p>

            <FieldError>{formError}</FieldError>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep("amount")}>
                Back
              </Button>
              <Button
                type="button"
                className="flex-1"
                isLoading={transferMutation.isPending}
                onClick={handleTransfer}
              >
                Confirm &amp; send
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "result" && result && recipient && (
        <Card className="w-full sm:max-w-md">
          <CardHeader>
            <CardTitle>Transfer {result.status === "COMPLETED" ? "sent" : "submitted"}</CardTitle>
            <CardDescription>Reference {result.referenceId}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {result.status === "FAILED" && (
              <Alert variant="destructive">
                <AlertDescription>
                  This transfer could not be completed. No amount was deducted.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Recipient</span>
              <span className="font-medium text-foreground">{recipient.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="font-medium text-foreground">{formatInr(result.amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Fee</span>
              <span className="font-medium text-foreground">{formatInr(result.fee)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total debited</span>
              <span className="font-semibold text-foreground">{formatInr(result.total)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusPill tone={transferStatusTone(result.status)}>{result.status}</StatusPill>
            </div>

            <Button variant="outline" className="mt-2" onClick={startOver}>
              Send another transfer
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
