import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, RotateCcw } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { StatusPill } from "@/components/ui/status-pill"
import type { Transaction, TransactionType } from "@/lib/api/transactions"
import { formatInr } from "@/lib/money"
import { transactionStatusTone } from "@/lib/status"
import { cn } from "@/lib/utils"

const TYPE_ICON: Record<TransactionType, LucideIcon> = {
  DEPOSIT: ArrowDownToLine,
  TRANSFER: ArrowLeftRight,
  TRANSFER_REVERSAL: RotateCcw,
  WITHDRAWAL: ArrowUpFromLine,
}

const TYPE_LABEL: Record<TransactionType, string> = {
  DEPOSIT: "Add money",
  TRANSFER: "Transfer",
  TRANSFER_REVERSAL: "Reversal",
  WITHDRAWAL: "Withdrawal",
}

const TYPE_ICON_TINT: Record<TransactionType, string> = {
  DEPOSIT: "bg-blue-500/10 text-blue-400",
  TRANSFER: "bg-violet-500/10 text-violet-400",
  TRANSFER_REVERSAL: "bg-slate-500/15 text-slate-400",
  WITHDRAWAL: "bg-amber-500/10 text-amber-400",
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function TransactionRow({
  transaction,
  onClick,
}: {
  transaction: Transaction
  onClick?: () => void
}) {
  const Icon = TYPE_ICON[transaction.type]

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-w-0 items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-muted"
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          TYPE_ICON_TINT[transaction.type]
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm font-medium text-foreground">
          {TYPE_LABEL[transaction.type]}
          {transaction.counterparty && (
            <span className="text-muted-foreground">
              {" "}
              · {transaction.direction === "DEBIT" ? "to" : "from"} {transaction.counterparty.name}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(transaction.createdAt)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p
          className={
            transaction.direction === "CREDIT"
              ? "font-mono text-sm font-medium text-success"
              : "font-mono text-sm font-medium text-foreground"
          }
        >
          {transaction.direction === "CREDIT" ? "+" : "−"}
          {formatInr(transaction.amount)}
        </p>
        <StatusPill tone={transactionStatusTone(transaction.status)}>{transaction.status}</StatusPill>
      </div>
    </button>
  )
}
