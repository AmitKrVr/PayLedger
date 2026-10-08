import { Badge } from "@/components/ui/badge"

export type StatusTone = "success" | "warning" | "danger" | "neutral"

const TONE_TO_BADGE_VARIANT: Record<StatusTone, "success" | "warning" | "danger" | "neutral"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "neutral",
}

export function StatusPill({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <Badge variant={TONE_TO_BADGE_VARIANT[tone]}>
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </Badge>
  )
}
