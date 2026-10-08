import { LayoutDashboard } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageLayout } from "@/components/page-layout"

export default function DashboardPage() {
  return (
    <PageLayout title="Dashboard" description="Overview of PayLedger admin operations.">
      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={LayoutDashboard}
          title="Dashboard coming soon"
          description="We will do after finishing this project fully and i have time left, as i managed my office from 10:00 AM to 6:30 PM and 3 hours travelling so i dont have too much time to focus on these area that's why leave this and focus on main requirements"
        />
      </div>
    </PageLayout>
  )
}
