"use client"

import Link from "next/link"
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { StatusPill } from "@/components/ui/status-pill"
import type { Wallet } from "@/lib/api/wallet"
import { formatInr } from "@/lib/money"
import { cn } from "@/lib/utils"

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: LucideIcon
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-xl bg-primary-foreground/10 px-2 py-3 text-center transition-colors hover:bg-primary-foreground/15"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-primary-foreground/15">
        <Icon className="size-4" />
      </span>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  )
}

export function BalanceCard({ wallet, className }: { wallet: Wallet; className?: string }) {
  const isBlocked = wallet.status === "BLOCKED"

  return (
    <Card className={cn("border-primary bg-primary text-primary-foreground", className)}>
      <CardContent className="flex flex-col gap-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-primary-foreground/70">Available balance</p>
            <p className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
              {formatInr(wallet.available)}
            </p>
          </div>
          {isBlocked && <StatusPill tone="danger">Blocked</StatusPill>}
        </div>

        {wallet.held > 0 && (
          <p className="text-xs text-primary-foreground/70">
            {formatInr(wallet.held)} held for a pending withdrawal
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          <QuickAction href="/payments" icon={ArrowDownToLine} label="Add Money" />
          <QuickAction href="/transfers" icon={ArrowLeftRight} label="Send" />
          <QuickAction href="/withdrawals" icon={ArrowUpFromLine} label="Withdraw" />
        </div>
      </CardContent>
    </Card>
  )
}
