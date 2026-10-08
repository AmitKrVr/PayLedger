import { Suspense } from "react"
import { AppShell } from "@/components/app-nav"
import { SessionGate } from "@/components/session-gate"

const AppShellLayout = ({ children }: LayoutProps<"/">) => {
    return (
        <Suspense>
            <SessionGate>
                <AppShell>{children}</AppShell>
            </SessionGate>
        </Suspense>
    )
}
export default AppShellLayout
