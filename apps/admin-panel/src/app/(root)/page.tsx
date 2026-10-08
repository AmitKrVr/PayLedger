"use client"

import Link from "next/link"
import { ArrowLeftRight, ArrowRight, Landmark } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageLayout } from "@/components/page-layout"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useWithdrawalsQuery } from "@/hooks/use-withdrawals"
import { getApiErrorMessage } from "@/lib/api/error-message"
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
  // Real counts, each a single cheap request (limit=1, only `meta.totalItems`
  // is used) -- PayLedger has no dedicated dashboard/stats API, so the only
  // honest numbers available here come from the withdrawal list endpoint.
  const pending = useWithdrawalsQuery({ page: 1, limit: 1, status: "PENDING" })
  const approved = useWithdrawalsQuery({ page: 1, limit: 1, status: "APPROVED" })
  const rejected = useWithdrawalsQuery({ page: 1, limit: 1, status: "REJECTED" })
  const recentPending = useWithdrawalsQuery({ page: 1, limit: 5, status: "PENDING" })

  const isLoading = pending.isLoading || approved.isLoading || rejected.isLoading
  const isError = pending.isError || approved.isError || rejected.isError

  return (
    <PageLayout title="Dashboard" description="Overview of PayLedger admin operations.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending withdrawals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-foreground">
                {pending.data?.meta.totalItems ?? "—"}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved withdrawals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-foreground">
                {approved.data?.meta.totalItems ?? "—"}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rejected withdrawals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-foreground">
                {rejected.data?.meta.totalItems ?? "—"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {isError && (
        <p className="text-sm text-destructive">
          {getApiErrorMessage(pending.error ?? approved.error ?? rejected.error)}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Needs attention</CardTitle>
            <Link href="/withdrawals">
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            {recentPending.isLoading && (
              <div className="flex flex-col gap-2 px-(--card-spacing)">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}

            {!recentPending.isLoading && recentPending.data?.items.length === 0 && (
              <EmptyState
                icon={Landmark}
                title="No pending withdrawals"
                description="All withdrawal requests have been processed."
              />
            )}

            {!recentPending.isLoading &&
              recentPending.data?.items.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between gap-3 px-(--card-spacing) py-2.5 not-last:border-b border-border"
                >
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {withdrawal.user.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{withdrawal.user.mobile}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      {formatAmount(withdrawal.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(withdrawal.requestedAt)}
                    </p>
                  </div>
                  <StatusBadge variant={withdrawalStatusVariant(withdrawal.status)}>
                    {withdrawalStatusLabel(withdrawal.status)}
                  </StatusBadge>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link href="/withdrawals">
              <Button variant="outline" className="w-full justify-start">
                <Landmark className="size-4" />
                Review withdrawals
              </Button>
            </Link>
            <Link href="/transfers">
              <Button variant="outline" className="w-full justify-start">
                <ArrowLeftRight className="size-4" />
                Reverse a transfer
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
