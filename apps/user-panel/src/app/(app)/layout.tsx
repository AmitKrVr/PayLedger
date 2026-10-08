import { Suspense } from "react"
import { AppNav } from "@/components/app-nav"
import { SessionGate } from "@/components/session-gate"

const AppShellLayout = ({ children }: LayoutProps<"/">) => {
    return (
        <Suspense>
            <SessionGate>
                <AppNav />
                <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
                    {children}
                </main>
            </SessionGate>
        </Suspense>
    )
}
export default AppShellLayout
