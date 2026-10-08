"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Eye,
  EyeOff,
  Wallet as WalletIcon,
} from "lucide-react"
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
  primary,
}: {
  href: string
  icon: LucideIcon
  label: string
  primary?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-colors",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-white/15 text-foreground hover:bg-white/5"
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  )
}

export function BalanceCard({ wallet, className }: { wallet: Wallet; className?: string }) {
  const isBlocked = wallet.status === "BLOCKED"
  const [hidden, setHidden] = React.useState(false)

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-primary/20 bg-linear-to-br from-[#12160f] via-[#0d0f0c] to-[#0d0f0c]",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-primary/10 blur-3xl"
      />

      <CardContent className="relative flex flex-col gap-6 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <WalletIcon className="size-3.5" />
              <p className="text-[11px] font-medium tracking-widest uppercase">
                Available balance
              </p>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <p className="font-mono text-5xl font-medium tracking-tight text-foreground sm:text-6xl">
                {hidden ? "••••••" : formatInr(wallet.available)}
              </p>
              <button
                type="button"
                onClick={() => setHidden((prev) => !prev)}
                aria-label={hidden ? "Show balance" : "Hide balance"}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>
          </div>
          {isBlocked ? (
            <StatusPill tone="danger">Blocked</StatusPill>
          ) : (
            <StatusPill tone="success">Active</StatusPill>
          )}
        </div>

        {wallet.held > 0 && (
          <span className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-amber-400" />
            <span className="font-mono text-amber-400">{hidden ? "••••" : formatInr(wallet.held)}</span>
            held for a pending withdrawal
          </span>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <QuickAction href="/payments" icon={ArrowDownToLine} label="Add money" primary />
          <QuickAction href="/transfers" icon={ArrowLeftRight} label="Send" />
          <QuickAction href="/withdrawals" icon={ArrowUpFromLine} label="Withdraw" />
        </div>
      </CardContent>
    </Card>
  )
}
