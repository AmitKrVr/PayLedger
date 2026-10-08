"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft, Landmark, Receipt } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageLayout } from "@/components/page-layout"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useUserQuery } from "@/hooks/use-users"
import { getApiErrorMessage } from "@/lib/api/error-message"
import { transactionStatusVariant, transactionTypeLabel } from "@/lib/transactions/status"
import { withdrawalStatusVariant } from "@/lib/withdrawals/status"

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: user, isLoading, isError, error } = useUserQuery(id)

  return (
    <PageLayout
      back={
        <Link href="/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-3.5" />
            Back to users
          </Button>
        </Link>
      }
      title={isLoading ? "Loading..." : user?.name}
      description={user?.mobile}
    >
      {isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {isError && (
        <EmptyState
          icon={Landmark}
          title="Failed to load user"
          description={getApiErrorMessage(error)}
        />
      )}

      {user && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBadge
                  variant={
                    user.status === "ACTIVE"
                      ? "success"
                      : user.status === "BLOCKED"
                        ? "danger"
                        : "warning"
                  }
                >
                  {user.status}
                </StatusBadge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Available balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold text-foreground">
                  {user.wallet ? formatAmount(user.wallet.available) : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Held
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold text-foreground">
                  {user.wallet ? formatAmount(user.wallet.held) : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Wallet status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {user.wallet ? (
                  <StatusBadge variant={user.wallet.status === "ACTIVE" ? "success" : "danger"}>
                    {user.wallet.status}
                  </StatusBadge>
                ) : (
                  "—"
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground">{user.email ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Joined / Last login
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground">
                  {formatDate(user.createdAt)}
                  {user.lastLoginAt && ` · last login ${formatDate(user.lastLoginAt)}`}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Recent transactions</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                {user.recentTransactions.length === 0 && (
                  <EmptyState icon={Receipt} title="No transactions" />
                )}
                {user.recentTransactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between gap-3 px-(--card-spacing) py-2.5 not-last:border-b border-border"
                  >
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {transactionTypeLabel(
                          txn.type as
                            | "DEPOSIT"
                            | "TRANSFER"
                            | "TRANSFER_REVERSAL"
                            | "WITHDRAWAL",
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(txn.createdAt)}</p>
                    </div>
                    <StatusBadge
                      variant={transactionStatusVariant(
                        txn.status as "PENDING" | "COMPLETED" | "FAILED" | "REVERSED",
                      )}
                    >
                      {txn.status}
                    </StatusBadge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent payments</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                {user.recentPayments.length === 0 && (
                  <EmptyState icon={Receipt} title="No payments" />
                )}
                {user.recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-3 px-(--card-spacing) py-2.5 not-last:border-b border-border"
                  >
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {formatAmount(payment.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.createdAt)}
                      </p>
                    </div>
                    <StatusBadge variant="neutral">{payment.status}</StatusBadge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent withdrawals</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                {user.recentWithdrawals.length === 0 && (
                  <EmptyState icon={Landmark} title="No withdrawals" />
                )}
                {user.recentWithdrawals.map((withdrawal) => (
                  <div
                    key={withdrawal.id}
                    className="flex items-center justify-between gap-3 px-(--card-spacing) py-2.5 not-last:border-b border-border"
                  >
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {formatAmount(withdrawal.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(withdrawal.requestedAt)}
                      </p>
                    </div>
                    <StatusBadge variant={withdrawalStatusVariant(withdrawal.status as "PENDING" | "APPROVED" | "REJECTED")}>
                      {withdrawal.status}
                    </StatusBadge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageLayout>
  )
}
