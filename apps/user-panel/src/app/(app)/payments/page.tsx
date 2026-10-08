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
import { useCreatePayment, usePaymentStatusQuery } from "@/hooks/use-payments"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { formatInr } from "@/lib/money"
import { paymentStatusTone } from "@/lib/status"

const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED", "CANCELLED", "EXPIRED"])

export default function PaymentsPage() {
  const [amountInput, setAmountInput] = React.useState("")
  const [formError, setFormError] = React.useState<string | null>(null)
  const [activePaymentId, setActivePaymentId] = React.useState<string | null>(null)
  const notifiedPaymentIdRef = React.useRef<string | null>(null)

  const queryClient = useQueryClient()
  const { data: limits } = useLimitsQuery()
  const createPaymentMutation = useCreatePayment()
  const paymentQuery = usePaymentStatusQuery(activePaymentId)

  const payment = paymentQuery.data
  const isTerminal = payment ? TERMINAL_STATUSES.has(payment.status) : false

  React.useEffect(() => {
    if (payment?.status === "SUCCESS" && notifiedPaymentIdRef.current !== payment.id) {
      notifiedPaymentIdRef.current = payment.id
      toast.success("Money added to your wallet")
      queryClient.invalidateQueries({ queryKey: ["wallet"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    }
  }, [payment?.status, payment?.id, queryClient])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const amount = Number(amountInput)
    if (!amountInput || Number.isNaN(amount) || amount <= 0) {
      setFormError("Enter a valid amount")
      return
    }
    if (limits && (amount < limits.payment.minAmount || amount > limits.payment.maxAmount)) {
      setFormError(
        `Amount must be between ${formatInr(limits.payment.minAmount)} and ${formatInr(limits.payment.maxAmount)}`
      )
      return
    }

    createPaymentMutation.mutate(
      { amount, idempotencyKey: crypto.randomUUID() },
      {
        onSuccess: (created) => {
          setActivePaymentId(created.id)
        },
        onError: (error) => {
          setFormError(getApiErrorMessage(error, "Failed to create payment"))
        },
      }
    )
  }

  const startNewPayment = () => {
    setActivePaymentId(null)
    setAmountInput("")
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Add Money</h1>

      {!activePaymentId && (
        <Card className="w-full sm:max-w-md">
          <CardHeader>
            <CardTitle>How much would you like to add?</CardTitle>
            <CardDescription>Funds are added via our payment partner.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

              <Button type="submit" size="lg" isLoading={createPaymentMutation.isPending}>
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activePaymentId && payment && (
        <Card className="w-full sm:max-w-md">
          <CardHeader>
            <CardTitle>Payment status</CardTitle>
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
                <p className="text-xs text-muted-foreground">
                  Waiting for confirmation from our payment partner. This page updates
                  automatically.
                </p>
              </>
            )}

            {isTerminal && payment.status !== "SUCCESS" && (
              <Alert variant="destructive">
                <AlertDescription>
                  This payment did not complete. No amount was added to your wallet.
                </AlertDescription>
              </Alert>
            )}

            {isTerminal && (
              <Button variant="outline" onClick={startNewPayment}>
                Add more money
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
