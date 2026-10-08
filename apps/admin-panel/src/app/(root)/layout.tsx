import { Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { RouteSearchBar } from "@/components/route-search-bar"
import { SessionGate } from "@/components/session-gate"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

const RootLayout = ({ children }: LayoutProps<"/">) => {
    return (
        <Suspense>
            <SessionGate>
                <SidebarProvider>
                    <AppSidebar variant="floating" />
                    <SidebarInset>
                        {/* group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 */}
                        <header
                            style={{ top: "var(--banner-offset, 0px)" }}
                            className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background/80 backdrop-blur-sm h-12 px-4 sticky z-20"
                        >
                            <div className="flex items-center gap-2">
                                <SidebarTrigger className="-ml-1" />
                                <Separator
                                    orientation="vertical"
                                    className="mr-2 data-vertical:h-4 data-vertical:self-auto"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <RouteSearchBar />
                            </div>
                        </header>
                        <main className="@container flex flex-1 flex-col gap-4 px-4 py-2 border-t">
                            {children}
                        </main>
                    </SidebarInset>
                </SidebarProvider>
            </SessionGate>
        </Suspense>
    )
}
export default RootLayout