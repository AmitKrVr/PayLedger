import type { LucideIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageLayout } from "@/components/page-layout"

/**
 * For nav items with no backing PayLedger admin API yet. Never wire
 * this to fake data -- once the real API exists, replace the page body,
 * not this placeholder.
 */
export function FeaturePlaceholderPage({
  icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <PageLayout title={title}>
      <div className="rounded-xl border border-border bg-card">
        <EmptyState icon={icon} title="Not available yet" description={description} />
      </div>
    </PageLayout>
  )
}
