import { ShieldCheck, Sparkles, Zap } from "lucide-react"

const HIGHLIGHTS = [
    { icon: Zap, text: "Instant transfers to any PayLedger user" },
    { icon: ShieldCheck, text: "Bank-grade security on every transaction" },
    { icon: Sparkles, text: "One wallet for payments, transfers, and withdrawals" },
]

function BrandMark() {
    return (
        <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                P
            </span>
            <span className="text-lg font-semibold text-foreground">PayLedger</span>
        </div>
    )
}

const AuthLayout = ({ children }: LayoutProps<"/">) => {
    return (
        <div className="flex min-h-screen bg-background">
            <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden border-r border-border bg-[#0d0f0c] p-10 lg:flex">
                <div
                    aria-hidden
                    className="pointer-events-none absolute -top-32 -right-20 size-96 rounded-full bg-primary/10 blur-3xl"
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-primary/[0.05] blur-3xl"
                />

                <BrandMark />

                <div className="relative flex flex-col gap-8">
                    <p className="text-3xl leading-tight font-semibold text-balance text-foreground">
                        Send, receive, and manage your money in one place.
                    </p>
                    <ul className="flex flex-col gap-4">
                        {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                            <li key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Icon className="size-4" />
                                </span>
                                {text}
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative text-xs text-muted-foreground/70">
                    &copy; {new Date().getFullYear()} PayLedger
                </p>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center p-4">
                <div className="mb-8 lg:hidden">
                    <BrandMark />
                </div>
                {children}
            </div>
        </div>
    )
}
export default AuthLayout
