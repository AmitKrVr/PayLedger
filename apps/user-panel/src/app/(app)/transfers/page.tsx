"use client"

import * as React from "react"
import type { SubmitEvent } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeftRight, ArrowRight } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { StepIndicator } from "@/components/step-indicator"
import { TransactionRow } from "@/components/transaction-row"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { useLimitsQuery } from "@/hooks/use-config"
import { useCreateTransfer, useLookupRecipient } from "@/hooks/use-transfers"
import { useTransactionsQuery } from "@/hooks/use-transactions"
import { getApiErrorMessage } from "@/lib/api/error-message"
import type { RecipientSummary, Transfer } from "@/lib/api/transfers"
import { formatInr } from "@/lib/money"
import { transferStatusTone } from "@/lib/status"
import { blockInvalidNumberKeys, digitsOnly } from "@/lib/utils"

type Step = "mobile" | "amount" | "confirm" | "result"

const STEPS = ["Recipient", "Amount", "Confirm", "Done"]
const STEP_INDEX: Record<Step, number> = { mobile: 0, amount: 1, confirm: 2, result: 3 }

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
  const recentTransfers = useTransactionsQuery({ page: 1, limit: 6, type: "TRANSFER" })

  const amount = Number(amountInput)
  const estimatedFee = limits && amount > 0 ? estimateFee(amount, limits.transfer) : null
  const estimatedTotal = estimatedFee !== null ? amount + estimatedFee : null

  const handleLookup = (e: SubmitEvent<HTMLFormElement>) => {
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

  const handleContinueToConfirm = (e: SubmitEvent<HTMLFormElement>) => {
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
      <PageHeader
        icon={ArrowLeftRight}
        title="Send Money"
        description="Transfer funds to any PayLedger user instantly."
        tint="violet"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-6">
          <StepIndicator steps={STEPS} current={STEP_INDEX[step]} />

          {step === "mobile" && (
            <Card>
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
                      inputMode="numeric"
                      autoFocus
                      placeholder="10-digit mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(digitsOnly(e.target.value, 10))}
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
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {recipient.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <CardTitle>{recipient.name}</CardTitle>
                    <CardDescription>Enter how much to send.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleContinueToConfirm} className="flex flex-col gap-4">
                  <Field>
                    <FieldLabel htmlFor="amount">Amount (INR)</FieldLabel>
                    <Input
                      id="amount"
                      type="number"
                      inputMode="decimal"
                      min="1"
                      max={limits?.transfer.maxAmount}
                      step="0.01"
                      autoFocus
                      placeholder="e.g. 100"
                      onKeyDown={blockInvalidNumberKeys}
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
            <Card>
              <CardHeader>
                <CardTitle>Confirm transfer</CardTitle>
                <CardDescription>Review before you send.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-xl bg-muted px-3.5 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {recipient.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{recipient.name}</p>
                    <p className="text-xs text-muted-foreground">Recipient</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-mono font-medium text-foreground">{formatInr(amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated fee</span>
                  <span className="font-mono font-medium text-foreground">
                    {estimatedFee !== null ? formatInr(estimatedFee) : "—"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated total</span>
                  <span className="font-mono font-semibold text-foreground">
                    {estimatedTotal !== null ? formatInr(estimatedTotal) : "—"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  The fee shown here is an estimate. The exact fee is calculated by PayLedger
                  when your transfer is submitted.
                </p>

                <FieldError>{formError}</FieldError>

                <div className="flex gap-3">
                  {/* <Button type="button" variant="outline" onClick={() => setStep("amount")}>
                Back
              </Button> */}
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
            <Card>
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
                  <span className="font-mono font-medium text-foreground">{formatInr(result.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fee</span>
                  <span className="font-mono font-medium text-foreground">{formatInr(result.fee)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total debited</span>
                  <span className="font-mono font-semibold text-foreground">{formatInr(result.total)}</span>
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

        <Card>
          <CardHeader>
            <CardTitle>Recent transfers</CardTitle>
            <CardDescription>Money sent and received recently.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 px-2 pt-0">
            {recentTransfers.isLoading && (
              <div className="flex flex-col gap-2 px-2.5 py-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}

            {!recentTransfers.isLoading && recentTransfers.data?.items.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                <ArrowLeftRight className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">No transfers yet</p>
                <p className="text-sm text-muted-foreground">
                  Money you send or receive will show up here.
                </p>
              </div>
            )}

            {recentTransfers.data?.items.map((txn) => (
              <TransactionRow key={txn.id} transaction={txn} />
            ))}

            {recentTransfers.data && recentTransfers.data.items.length > 0 && (
              <Link
                href="/transactions"
                className="mt-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                View all transactions <ArrowRight className="size-3.5" />
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
