import { Suspense } from "react"
import Background from "@/components/Background"
import { GuestGate } from "@/components/guest-gate"

const AuthLayout = ({ children }: LayoutProps<"/">) => {
    return (
        <Suspense>
            <GuestGate>
                <Background>
                    {children}
                </Background>
            </GuestGate>
        </Suspense>
    )
}
export default AuthLayout