"use client"

import { Info, RotateCw } from "lucide-react"

import { BalanceCard } from "@/components/balance-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/ui/status-pill"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useWalletQuery } from "@/hooks/use-wallet"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { formatInr } from "@/lib/money"

export default function WalletPage() {
  const { data: wallet, isLoading, isError, error, refetch, isFetching } = useWalletQuery()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Wallet</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RotateCw className={isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{getApiErrorMessage(error, "Failed to load wallet")}</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {wallet && (
        <>
          <BalanceCard wallet={wallet} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total balance
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-lg font-semibold text-foreground sm:text-xl">
                  {formatInr(wallet.balance)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center gap-1.5 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Held
                </CardTitle>
                <Tooltip>
                  <TooltipTrigger type="button" aria-label="What is held balance?">
                    <Info className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Funds reserved for a pending withdrawal, not yet released.
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-lg font-semibold text-foreground sm:text-xl">
                  {formatInr(wallet.held)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <StatusPill tone={wallet.status === "ACTIVE" ? "success" : "danger"}>
                  {wallet.status}
                </StatusPill>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
