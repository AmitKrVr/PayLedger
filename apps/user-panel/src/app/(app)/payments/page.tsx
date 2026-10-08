"use client"

import * as React from "react"
import type { SubmitEvent } from "react"
import { ArrowDownToLine, CheckCircle2, Landmark, Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { StepIndicator } from "@/components/step-indicator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { useLimitsQuery } from "@/hooks/use-config"
import {
  useCreatePayment,
  usePaymentsQuery,
  usePaymentStatusQuery,
  useSimulatePayment,
} from "@/hooks/use-payments"
import { getApiErrorMessage } from "@/lib/api/error-message"
import type { Payment } from "@/lib/api/payments"
import { formatInr } from "@/lib/money"
import { paymentStatusTone } from "@/lib/status"
import { blockInvalidNumberKeys, cn } from "@/lib/utils"

type Step = "form" | "review" | "payment"

const STEPS = ["Amount", "Review", "Pay"]
const STEP_INDEX: Record<Step, number> = { form: 0, review: 1, payment: 2 }

const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED", "CANCELLED", "EXPIRED"])
const UNSUCCESSFUL_STATUSES = new Set(["FAILED", "CANCELLED", "EXPIRED"])
const PAGE_SIZE = 10

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function PaymentHistoryRow({ payment }: { payment: Payment }) {
  const isUnsuccessful = UNSUCCESSFUL_STATUSES.has(payment.status)

  return (
    <div className="flex w-full min-w-0 items-center gap-3 rounded-xl px-2.5 py-2.5">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          isUnsuccessful ? "bg-destructive/10 text-destructive" : "bg-blue-500/10 text-blue-400"
        )}
      >
        <ArrowDownToLine className="size-4.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm font-medium text-foreground">Add money</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(payment.createdAt)}
          {payment.failureReason && ` · ${payment.failureReason}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="font-mono text-sm font-medium text-foreground">{formatInr(payment.amount)}</p>
        <StatusPill tone={paymentStatusTone(payment.status)}>{payment.status}</StatusPill>
      </div>
    </div>
  )
}

export default function PaymentsPage() {
  const [step, setStep] = React.useState<Step>("form")
  const [amountInput, setAmountInput] = React.useState("")
  const [formError, setFormError] = React.useState<string | null>(null)
  const [activePaymentId, setActivePaymentId] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const notifiedPaymentIdRef = React.useRef<string | null>(null)

  const { data: limits } = useLimitsQuery()
  const createPaymentMutation = useCreatePayment()
  const simulateMutation = useSimulatePayment()
  const paymentQuery = usePaymentStatusQuery(activePaymentId)
  const history = usePaymentsQuery({ page, limit: PAGE_SIZE })

  const payment = paymentQuery.data
  const isTerminal = payment ? TERMINAL_STATUSES.has(payment.status) : false
  const amount = Number(amountInput)

  React.useEffect(() => {
    if (payment?.status === "SUCCESS" && notifiedPaymentIdRef.current !== payment.id) {
      notifiedPaymentIdRef.current = payment.id
      toast.success("Money added to your wallet")
    }
  }, [payment?.status, payment?.id])

  const validateAmount = (): boolean => {
    setFormError(null)
    if (!amountInput || Number.isNaN(amount) || amount <= 0) {
      setFormError("Enter a valid amount")
      return false
    }
    if (limits && (amount < limits.payment.minAmount || amount > limits.payment.maxAmount)) {
      setFormError(
        `Amount must be between ${formatInr(limits.payment.minAmount)} and ${formatInr(limits.payment.maxAmount)}`
      )
      return false
    }
    return true
  }

  const handleContinue = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (validateAmount()) setStep("review")
  }

  const handleConfirm = () => {
    createPaymentMutation.mutate(
      { amount, idempotencyKey: crypto.randomUUID() },
      {
        onSuccess: (created) => {
          setActivePaymentId(created.id)
          setStep("payment")
          setPage(1)
        },
        onError: (error) => {
          setFormError(getApiErrorMessage(error, "Failed to create payment"))
          setStep("form")
        },
      }
    )
  }

  const handleSimulate = (outcome: "SUCCESS" | "FAILED") => {
    if (!activePaymentId) return
    simulateMutation.mutate(
      { id: activePaymentId, outcome },
      {
        onError: (error) => {
          toast.error(getApiErrorMessage(error, "Could not complete the payment"))
        },
      }
    )
  }

  const startOver = () => {
    setStep("form")
    setAmountInput("")
    setFormError(null)
    setActivePaymentId(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ArrowDownToLine}
        title="Add Money"
        description="Top up your wallet via our payment partner."
        tint="blue"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-6">
          <StepIndicator steps={STEPS} current={STEP_INDEX[step]} />

          {step === "form" && (
            <Card>
              <CardHeader>
                <CardTitle>How much would you like to add?</CardTitle>
                <CardDescription>Enter an amount to get started.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleContinue} className="flex flex-col gap-4">
                  <Field>
                    <FieldLabel htmlFor="amount">Amount (INR)</FieldLabel>
                    <Input
                      id="amount"
                      type="number"
                      inputMode="decimal"
                      min={limits?.payment.minAmount ?? 1}
                      max={limits?.payment.maxAmount}
                      step="0.01"
                      autoFocus
                      placeholder="e.g. 500"
                      onKeyDown={blockInvalidNumberKeys}
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                    />
                    {limits && (
                      <p className="text-xs text-muted-foreground">
                        Min {formatInr(limits.payment.minAmount)} · Max{" "}
                        {formatInr(limits.payment.maxAmount)} per transaction
                      </p>
                    )}
                    <FieldError>{formError}</FieldError>
                  </Field>

                  <Button type="submit" size="lg">
                    Continue
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {step === "review" && (
            <Card>
              <CardHeader>
                <CardTitle>Review your deposit</CardTitle>
                <CardDescription>Confirm the amount before proceeding to payment.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-xl bg-muted px-3.5 py-3">
                  <span className="text-sm text-muted-foreground">You&apos;re adding</span>
                  <span className="font-mono text-xl font-semibold text-foreground">{formatInr(amount)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  You&apos;ll be taken to our payment partner to complete this deposit.
                </p>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep("form")}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    isLoading={createPaymentMutation.isPending}
                    onClick={handleConfirm}
                  >
                    Confirm &amp; pay
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "payment" && payment && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {payment.status === "SUCCESS" && "Payment successful"}
                  {(payment.status === "FAILED" || payment.status === "CANCELLED") && "Payment failed"}
                  {payment.status === "EXPIRED" && "Payment expired"}
                  {!isTerminal && "Complete your payment"}
                </CardTitle>
                <CardDescription>Order {payment.orderId}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-mono font-semibold text-foreground">{formatInr(payment.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <StatusPill tone={paymentStatusTone(payment.status)}>{payment.status}</StatusPill>
                </div>

                {!isTerminal && (
                  <>
                    <Separator />
                    <div className="flex flex-col items-center gap-3 py-2 text-center">
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Waiting for payment confirmation from our partner.
                      </p>
                    </div>

                    <div className="rounded-xl border border-dashed border-border p-3">
                      <p className="mb-3 text-xs text-muted-foreground">
                        This is a simulated payment partner for testing. Use the buttons below to
                        complete the checkout.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          className="flex-1"
                          isLoading={simulateMutation.isPending}
                          onClick={() => handleSimulate("SUCCESS")}
                        >
                          <CheckCircle2 className="size-4" />
                          success
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          disabled={simulateMutation.isPending}
                          onClick={() => handleSimulate("FAILED")}
                        >
                          <XCircle className="size-4" />
                          failure
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {isTerminal && payment.status !== "SUCCESS" && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {payment.status === "EXPIRED"
                        ? "This payment order expired before it was completed."
                        : (payment.failureReason ?? "This payment did not complete.")}{" "}
                      No amount was added to your wallet.
                    </AlertDescription>
                  </Alert>
                )}

                {isTerminal && (
                  <Button variant="outline" onClick={startOver}>
                    <Landmark className="size-4" />
                    Add more money
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Deposit history</CardTitle>
            <CardDescription>
              Every deposit you&apos;ve attempted, including ones that didn&apos;t go through.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 px-2 pt-0">
            {history.isLoading && (
              <div className="flex flex-col gap-2 px-2.5 py-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}

            {!history.isLoading && history.data?.items.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                <ArrowDownToLine className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">No deposits yet</p>
                <p className="text-sm text-muted-foreground">
                  Money you add will show up here.
                </p>
              </div>
            )}

            {history.data?.items.map((payment) => (
              <PaymentHistoryRow key={payment.id} payment={payment} />
            ))}

            {history.data && history.data.meta.totalPages > 1 && (
              <div className="px-2.5 pt-2">
                <Pagination
                  page={history.data.meta.page}
                  totalPages={history.data.meta.totalPages}
                  hasNextPage={history.data.meta.hasNextPage}
                  hasPreviousPage={history.data.meta.hasPreviousPage}
                  onPageChange={setPage}
                  disabled={history.isFetching}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
