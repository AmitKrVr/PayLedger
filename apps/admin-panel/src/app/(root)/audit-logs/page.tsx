import { ScrollText } from "lucide-react"

import { FeaturePlaceholderPage } from "@/components/feature-placeholder"

export default function AuditLogsPage() {
  return (
    <FeaturePlaceholderPage
      icon={ScrollText}
      title="Audit Logs"
      description="Audit events are already recorded by the backend for withdrawal and transfer actions, but there is no admin-facing read API for them yet. This page will list audit logs once that API exists."
    />
  )
}
