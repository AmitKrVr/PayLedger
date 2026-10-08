import { Suspense } from "react"
import { GuestGate } from "@/components/guest-gate"

const AuthLayout = ({ children }: LayoutProps<"/">) => {
    return (
        <Suspense>
            <GuestGate>
                <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
                    <div className="mb-8 flex items-center gap-2 text-primary">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
                            P
                        </span>
                        <span className="text-lg font-semibold text-foreground">PayLedger</span>
                    </div>
                    {children}
                </div>
            </GuestGate>
        </Suspense>
    )
}
export default AuthLayout
