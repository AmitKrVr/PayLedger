"use client"

import * as React from "react"
import { CheckCircle2, Landmark, Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { StatusPill } from "@/components/ui/status-pill"
import { useLimitsQuery } from "@/hooks/use-config"
import { useCreatePayment, usePaymentStatusQuery, useSimulatePayment } from "@/hooks/use-payments"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { formatInr } from "@/lib/money"
import { paymentStatusTone } from "@/lib/status"

type Step = "form" | "review" | "payment"

const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED", "CANCELLED", "EXPIRED"])

export default function PaymentsPage() {
  const [step, setStep] = React.useState<Step>("form")
  const [amountInput, setAmountInput] = React.useState("")
  const [formError, setFormError] = React.useState<string | null>(null)
  const [activePaymentId, setActivePaymentId] = React.useState<string | null>(null)
  const notifiedPaymentIdRef = React.useRef<string | null>(null)

  const { data: limits } = useLimitsQuery()
  const createPaymentMutation = useCreatePayment()
  const simulateMutation = useSimulatePayment()
  const paymentQuery = usePaymentStatusQuery(activePaymentId)

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

  const handleContinue = (e: React.FormEvent) => {
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
      <h1 className="text-2xl font-semibold text-foreground">Add Money</h1>

      {step === "form" && (
        <Card className="w-full sm:max-w-md">
          <CardHeader>
            <CardTitle>How much would you like to add?</CardTitle>
            <CardDescription>Funds are added via our payment partner.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleContinue} className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="amount">Amount (INR)</FieldLabel>
                <Input
                  id="amount"
                  type="number"
                  min={limits?.payment.minAmount ?? 1}
                  max={limits?.payment.maxAmount}
                  step="0.01"
                  autoFocus
                  placeholder="e.g. 500"
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
        <Card className="w-full sm:max-w-md">
          <CardHeader>
            <CardTitle>Review your deposit</CardTitle>
            <CardDescription>Confirm the amount before proceeding to payment.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-xl bg-muted px-3.5 py-3">
              <span className="text-sm text-muted-foreground">You&apos;re adding</span>
              <span className="text-xl font-bold text-foreground">{formatInr(amount)}</span>
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
        <Card className="w-full sm:max-w-md">
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
              <span className="font-semibold text-foreground">{formatInr(payment.amount)}</span>
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
                      Simulate success
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={simulateMutation.isPending}
                      onClick={() => handleSimulate("FAILED")}
                    >
                      <XCircle className="size-4" />
                      Simulate failure
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
                    : "This payment did not complete."}{" "}
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
  )
}
