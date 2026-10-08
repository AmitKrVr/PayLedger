import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const TINTS = {
  primary: "bg-accent text-accent-foreground",
  blue: "bg-blue-500/10 text-blue-400",
  violet: "bg-violet-500/10 text-violet-400",
  amber: "bg-amber-500/10 text-amber-400",
  slate: "bg-slate-500/15 text-slate-400",
} as const

export type PageHeaderTint = keyof typeof TINTS

export function PageHeader({
  icon: Icon,
  title,
  description,
  tint = "primary",
  actions,
}: {
  icon: LucideIcon
  title: string
  description?: string
  tint?: PageHeaderTint
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            TINTS[tint]
          )}
        >
          <Icon className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
  )
}
