"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Landmark } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { WithdrawalDetailDialog } from "@/components/withdrawal-detail-dialog"
import { useLimitsQuery } from "@/hooks/use-config"
import { useWalletQuery } from "@/hooks/use-wallet"
import { useCreateWithdrawal, useWithdrawalsQuery } from "@/hooks/use-withdrawals"
import { getApiErrorMessage } from "@/lib/api/error-message"
import type { Withdrawal } from "@/lib/api/withdrawals"
import { formatInr } from "@/lib/money"
import { withdrawalStatusTone } from "@/lib/status"

const PAGE_SIZE = 10

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default function WithdrawalsPage() {
  const [amountInput, setAmountInput] = React.useState("")
  const [formError, setFormError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<Withdrawal | null>(null)
  const [page, setPage] = React.useState(1)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const queryClient = useQueryClient()
  const { data: limits } = useLimitsQuery()
  const { data: wallet } = useWalletQuery()
  const withdrawMutation = useCreateWithdrawal()
  const history = useWithdrawalsQuery({ page, limit: PAGE_SIZE })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const amount = Number(amountInput)
    if (!amountInput || Number.isNaN(amount) || amount <= 0) {
      setFormError("Enter a valid amount")
      return
    }
    if (limits && (amount < limits.withdrawal.minAmount || amount > limits.withdrawal.maxAmount)) {
      setFormError(
        `Amount must be between ${formatInr(limits.withdrawal.minAmount)} and ${formatInr(limits.withdrawal.maxAmount)}`
      )
      return
    }
    if (wallet && amount > wallet.available) {
      setFormError("Amount exceeds your available balance")
      return
    }

    withdrawMutation.mutate(
      { amount, idempotencyKey: crypto.randomUUID() },
      {
        onSuccess: (withdrawal) => {
          setResult(withdrawal)
          toast.success("Withdrawal request submitted")
          queryClient.invalidateQueries({ queryKey: ["wallet"] })
          queryClient.invalidateQueries({ queryKey: ["withdrawals", "list"] })
          setPage(1)
        },
        onError: (error) => {
          setFormError(getApiErrorMessage(error, "Failed to submit withdrawal"))
        },
      }
    )
  }

  const startNew = () => {
    setResult(null)
    setAmountInput("")
    setFormError(null)
  }

  const items = history.data?.items ?? []
  const meta = history.data?.meta

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Withdraw</h1>

      {!result && (
        <Card className="w-full sm:max-w-md">
          <CardHeader>
            <CardTitle>How much would you like to withdraw?</CardTitle>
            <CardDescription>
              Withdrawals are reviewed by our team before funds are released.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {wallet && wallet.status !== "ACTIVE" && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  Your wallet is {wallet.status.toLowerCase()}. Withdrawals are unavailable
                  until it&apos;s active again.
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {wallet && (
                <div className="flex items-center justify-between rounded-xl bg-muted px-3.5 py-2.5 text-sm">
                  <span className="text-muted-foreground">Available balance</span>
                  <span className="font-medium text-foreground">{formatInr(wallet.available)}</span>
                </div>
              )}

              <Field>
                <FieldLabel htmlFor="amount">Amount (INR)</FieldLabel>
                <Input
                  id="amount"
                  type="number"
                  min={limits?.withdrawal.minAmount ?? 1}
                  max={limits?.withdrawal.maxAmount}
                  step="0.01"
                  autoFocus
                  placeholder="e.g. 500"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  disabled={wallet ? wallet.status !== "ACTIVE" : false}
                />
                {limits && (
                  <p className="text-xs text-muted-foreground">
                    Min {formatInr(limits.withdrawal.minAmount)} · Max{" "}
                    {formatInr(limits.withdrawal.maxAmount)} per request
                  </p>
                )}
                <FieldError>{formError}</FieldError>
              </Field>

              <Button
                type="submit"
                size="lg"
                isLoading={withdrawMutation.isPending}
                disabled={wallet ? wallet.status !== "ACTIVE" : false}
              >
                Request withdrawal
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="w-full sm:max-w-md">
          <CardHeader>
            <CardTitle>Withdrawal requested</CardTitle>
            <CardDescription>
              Your request is pending review. We&apos;ll release funds once it&apos;s
              processed by our team &mdash; this is not instant.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="font-semibold text-foreground">{formatInr(result.amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusPill tone={withdrawalStatusTone(result.status)}>{result.status}</StatusPill>
            </div>

            <Button variant="outline" className="mt-2" onClick={startNew}>
              Request another withdrawal
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Withdrawal history</CardTitle>
          <CardDescription>Your past and pending withdrawal requests.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-0 pt-0">
          {history.isLoading && (
            <div className="flex flex-col gap-2 px-(--card-spacing)">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}

          {history.isError && (
            <div className="px-(--card-spacing)">
              <Alert variant="destructive">
                <AlertDescription>
                  {getApiErrorMessage(history.error, "Failed to load withdrawal history")}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {!history.isLoading && !history.isError && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <Landmark className="size-7 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No withdrawals yet</p>
              <p className="text-sm text-muted-foreground">
                Requests you submit will show up here with their status.
              </p>
            </div>
          )}

          {items.map((withdrawal) => (
            <button
              key={withdrawal.id}
              type="button"
              onClick={() => setSelectedId(withdrawal.id)}
              className="flex items-center justify-between gap-3 px-(--card-spacing) py-2.5 text-left transition-colors hover:bg-muted"
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">{formatInr(withdrawal.amount)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(withdrawal.createdAt)}</p>
              </div>
              <StatusPill tone={withdrawalStatusTone(withdrawal.status)}>
                {withdrawal.status}
              </StatusPill>
            </button>
          ))}

          {meta && meta.totalItems > 0 && (
            <div className="px-(--card-spacing)">
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                hasNextPage={meta.hasNextPage}
                hasPreviousPage={meta.hasPreviousPage}
                onPageChange={setPage}
                disabled={history.isFetching}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <WithdrawalDetailDialog
        withdrawalId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </div>
  )
}
