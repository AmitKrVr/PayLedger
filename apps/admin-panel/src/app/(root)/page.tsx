"use client"

import Link from "next/link"
import { ArrowLeftRight, ArrowRight, Landmark, Receipt, Users, Wallet } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageLayout } from "@/components/page-layout"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDashboardQuery } from "@/hooks/use-dashboard"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { paymentStatusLabel, paymentStatusVariant } from "@/lib/payments/status"
import { transferStatusLabel, transferStatusVariant } from "@/lib/transfers/status"
import {
  withdrawalStatusLabel,
  withdrawalStatusVariant,
} from "@/lib/withdrawals/status"

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboardQuery()
  const stats = data?.stats

  return (
    <PageLayout title="Dashboard" description="Overview of PayLedger admin operations.">
      {isError && (
        <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/users">
          <Card className="transition-colors hover:bg-muted/40">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                Total users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{stats?.totalUsers}</p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="size-4 text-muted-foreground" />
              Total wallet balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-foreground">
                {formatAmount(stats?.totalWalletBalance ?? 0)}
              </p>
            )}
          </CardContent>
        </Card>

        <Link href="/withdrawals?status=PENDING">
          <Card className="transition-colors hover:bg-muted/40">
            <CardHeader className="flex-row justify-between flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Landmark className="size-4 text-muted-foreground" />
                Pending withdrawals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-foreground">
                    {stats?.pendingWithdrawals.count}
                  </p>
                  {/* <p className="text-xs text-muted-foreground">
                    {formatAmount(stats?.pendingWithdrawals.amount ?? 0)} held
                  </p> */}
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/payments">
          <Card className="transition-colors hover:bg-muted/40">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Receipt className="size-4 text-muted-foreground" />
                Today&apos;s deposits
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-foreground">
                    {formatAmount(stats?.todaysDeposits.amount ?? 0)}
                  </p>
                  {/* <p className="text-xs text-muted-foreground">
                    {stats?.todaysDeposits.count} successful
                  </p> */}
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/transfers">
          <Card className="transition-colors hover:bg-muted/40">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ArrowLeftRight className="size-4 text-muted-foreground" />
                Today&apos;s transfers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-foreground">
                    {formatAmount(stats?.todaysTransfers.amount ?? 0)}
                  </p>
                  {/* <p className="text-xs text-muted-foreground">
                    {stats?.todaysTransfers.count} completed
                  </p> */}
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="size-4 text-muted-foreground" />
              Pending payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{stats?.pendingPayments}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Recent payments</CardTitle>
            <Link href="/payments">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            {isLoading && (
              <div className="flex flex-col gap-2 px-(--card-spacing)">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}
            {!isLoading && data?.recentPayments.length === 0 && (
              <EmptyState icon={Receipt} title="No payments yet" />
            )}
            {!isLoading &&
              data?.recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 px-(--card-spacing) py-2.5 not-last:border-b border-border"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate text-sm font-medium text-foreground">{payment.user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(payment.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="text-sm font-semibold text-foreground">
                      {formatAmount(payment.amount)}
                    </p>
                    <StatusBadge variant={paymentStatusVariant(payment.status)}>
                      {paymentStatusLabel(payment.status)}
                    </StatusBadge>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Recent transfers</CardTitle>
            <Link href="/transfers">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            {isLoading && (
              <div className="flex flex-col gap-2 px-(--card-spacing)">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}
            {!isLoading && data?.recentTransfers.length === 0 && (
              <EmptyState icon={ArrowLeftRight} title="No transfers yet" />
            )}
            {!isLoading &&
              data?.recentTransfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="flex items-center justify-between gap-3 px-(--card-spacing) py-2.5 not-last:border-b border-border"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {transfer.sender.name} → {transfer.recipient.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(transfer.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="text-sm font-semibold text-foreground">
                      {formatAmount(transfer.amount)}
                    </p>
                    <StatusBadge
                      variant={transferStatusVariant(
                        transfer.status as "PENDING" | "COMPLETED" | "FAILED" | "REVERSED",
                      )}
                    >
                      {transferStatusLabel(
                        transfer.status as "PENDING" | "COMPLETED" | "FAILED" | "REVERSED",
                      )}
                    </StatusBadge>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Recent withdrawals</CardTitle>
            <Link href="/withdrawals">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            {isLoading && (
              <div className="flex flex-col gap-2 px-(--card-spacing)">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}
            {!isLoading && data?.recentWithdrawals.length === 0 && (
              <EmptyState icon={Landmark} title="No withdrawals yet" />
            )}
            {!isLoading &&
              data?.recentWithdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between gap-3 px-(--card-spacing) py-2.5 not-last:border-b border-border"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {withdrawal.user.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(withdrawal.requestedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="text-sm font-semibold text-foreground">
                      {formatAmount(withdrawal.amount)}
                    </p>
                    <StatusBadge variant={withdrawalStatusVariant(withdrawal.status)}>
                      {withdrawalStatusLabel(withdrawal.status)}
                    </StatusBadge>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
