import { Landmark } from "lucide-react"

import { FeaturePlaceholderPage } from "@/components/feature-placeholder"

export default function PaymentsPage() {
  return (
    <FeaturePlaceholderPage
      icon={Landmark}
      title="Payments"
      description="PayLedger's payment APIs are user-scoped only; there is no admin-facing payment list/detail endpoint yet. This page will list payments once that API exists."
    />
  )
}
