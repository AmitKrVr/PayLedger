"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Receipt } from "lucide-react"

import { BalanceCard } from "@/components/balance-card"
import { TransactionRow } from "@/components/transaction-row"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TransactionDetailDialog } from "@/components/transaction-detail-dialog"
import { useTransactionsQuery } from "@/hooks/use-transactions"
import { useWalletQuery } from "@/hooks/use-wallet"
import { getApiErrorMessage } from "@/lib/api/error-message"

export default function DashboardPage() {
  const wallet = useWalletQuery()
  const recent = useTransactionsQuery({ page: 1, limit: 5 })
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Home</h1>

      {wallet.isLoading && <Skeleton className="h-44 w-full rounded-2xl" />}

      {wallet.isError && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{getApiErrorMessage(wallet.error, "Failed to load wallet")}</span>
            <Button size="sm" variant="outline" onClick={() => wallet.refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {wallet.data && <BalanceCard wallet={wallet.data} />}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent activity</CardTitle>
          <Link href="/transactions">
            <Button variant="ghost" size="sm">
              View all <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 px-2">
          {recent.isLoading && (
            <div className="flex flex-col gap-2 px-2.5 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {recent.isError && (
            <p className="px-2.5 py-4 text-sm text-destructive">
              {getApiErrorMessage(recent.error, "Failed to load recent activity")}
            </p>
          )}

          {!recent.isLoading && !recent.isError && recent.data?.items.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <Receipt className="size-7 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No activity yet</p>
              <p className="text-sm text-muted-foreground">
                Add money or send a transfer to see activity here.
              </p>
            </div>
          )}

          {recent.data?.items.map((txn) => (
            <TransactionRow key={txn.id} transaction={txn} onClick={() => setSelectedId(txn.id)} />
          ))}
        </CardContent>
      </Card>

      <TransactionDetailDialog
        transactionId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </div>
  )
}
