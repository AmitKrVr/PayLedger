import { cn } from "cn"

import { Badge } from "@/components/ui/badge"

export type StatusVariant = "success" | "warning" | "danger" | "neutral"

/** Semantic status colors -- deliberately separate from the app's
 * blue accent (globals.css): a status badge communicates state, not
 * brand. `!`-suffixed utilities (Tailwind v4's important modifier,
 * same convention already used in ui/sidebar.tsx) since Badge's own
 * "outline" variant already sets `text-foreground`, and Tailwind's
 * generated CSS order -- not class-attribute order -- decides which
 * wins otherwise. */
const VARIANT_CLASSES: Record<StatusVariant, string> = {
  success: "bg-emerald-50! text-emerald-700! border-emerald-200!",
  warning: "bg-amber-50! text-amber-700! border-amber-200!",
  danger: "bg-red-50! text-red-700! border-red-200!",
  neutral: "bg-zinc-100! text-zinc-700! border-zinc-200!",
}

const DOT_CLASSES: Record<StatusVariant, string> = {
  success: "bg-emerald-600",
  warning: "bg-amber-600",
  danger: "bg-red-600",
  neutral: "bg-zinc-500",
}

/** Resource-agnostic -- a per-domain helper (e.g. lib/users/status.ts)
 * maps its own status enum to a StatusVariant + label; this component
 * only knows how to render one. */
export function StatusBadge({
  variant,
  children,
}: {
  variant: StatusVariant
  children: React.ReactNode
}) {
  return (
    <Badge variant="outline" className={cn("gap-1.5", VARIANT_CLASSES[variant])}>
      <span className={cn("size-1.5 rounded-full", DOT_CLASSES[variant])} />
      {children}
    </Badge>
  )
}
