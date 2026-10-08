import { Users } from "lucide-react"

import { FeaturePlaceholderPage } from "@/components/feature-placeholder"

export default function UsersPage() {
  return (
    <FeaturePlaceholderPage
      icon={Users}
      title="Users"
      description="PayLedger does not yet have an admin users API. This page will list and manage users once that API exists."
    />
  )
}
