import { Receipt } from "lucide-react"

import { FeaturePlaceholderPage } from "@/components/feature-placeholder"

export default function TransactionsPage() {
  return (
    <FeaturePlaceholderPage
      icon={Receipt}
      title="Transactions"
      description="PayLedger's transaction history API is user-scoped only; there is no admin-facing endpoint yet. This page will list transactions once that API exists."
    />
  )
}
