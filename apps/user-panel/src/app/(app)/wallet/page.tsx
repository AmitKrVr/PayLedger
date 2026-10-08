"use client"

import { CheckCircle2, Info, Lock, RotateCw, Wallet as WalletIcon, XCircle } from "lucide-react"

import { BalanceCard } from "@/components/balance-card"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useWalletQuery } from "@/hooks/use-wallet"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { formatInr } from "@/lib/money"
import { cn } from "@/lib/utils"

function StatTile({
  icon: Icon,
  tint,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  tint: string
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-5">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", tint)}>
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            {hint}
          </div>
          <div className="truncate font-mono text-lg font-medium text-foreground">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function WalletPage() {
  const { data: wallet, isLoading, isError, error, refetch, isFetching } = useWalletQuery()
  const heldPercent = wallet && wallet.balance > 0 ? (wallet.held / wallet.balance) * 100 : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={WalletIcon}
        title="Wallet"
        description="A full breakdown of your balance."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RotateCw className={isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
            Refresh
          </Button>
        }
      />

      {isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
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

          {wallet.held > 0 && (
            <Card>
              <CardContent className="flex flex-col gap-3 pt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Balance breakdown</span>
                  <span className="font-mono text-muted-foreground">
                    {formatInr(wallet.available)} available of {formatInr(wallet.balance)}
                  </span>
                </div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="bg-primary" style={{ width: `${100 - heldPercent}%` }} />
                  <div className="bg-amber-500/70" style={{ width: `${heldPercent}%` }} />
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary" /> Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-500/70" /> Held
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              icon={WalletIcon}
              tint="bg-primary/10 text-primary"
              label="Total balance"
              value={formatInr(wallet.balance)}
            />
            <StatTile
              icon={Lock}
              tint="bg-amber-500/10 text-amber-400"
              label="Held"
              value={formatInr(wallet.held)}
              hint={
                <Tooltip>
                  <TooltipTrigger type="button" aria-label="What is held balance?">
                    <Info className="size-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Funds reserved for a pending withdrawal, not yet released.
                  </TooltipContent>
                </Tooltip>
              }
            />
            <StatTile
              icon={wallet.status === "ACTIVE" ? CheckCircle2 : XCircle}
              tint={
                wallet.status === "ACTIVE"
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }
              label="Status"
              value={wallet.status === "ACTIVE" ? "Active" : wallet.status}
            />
          </div>
        </>
      )}
    </div>
  )
}
