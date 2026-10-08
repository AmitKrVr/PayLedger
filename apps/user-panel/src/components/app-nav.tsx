"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeftRight, Home, Landmark, LogOut, Menu, Receipt, User, Wallet } from "lucide-react"

import { useLogout } from "@/hooks/use-logout"
import { useAuthStore } from "@/store/use-auth-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import Image from "next/image"

const NAV_ITEMS = [
  { title: "Home", url: "/", icon: Home },
  { title: "Wallet", url: "/wallet", icon: Wallet },
  { title: "Add Money", url: "/payments", icon: Landmark },
  { title: "Transfer", url: "/transfers", icon: ArrowLeftRight },
  { title: "Transactions", url: "/transactions", icon: Receipt },
  { title: "Withdraw", url: "/withdrawals", icon: Landmark },
]

function Brand() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <Image
        src="/logo.svg"
        alt="logo"
        height={40}
        width={150}
        className="h-12 w-48"
      />
    </Link>
  )
}

function useIsActive() {
  const pathname = usePathname()
  return (url: string) => pathname === url || pathname.startsWith(`${url}/`)
}

function NavLink({
  item,
  active,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[number]
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={item.url}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <item.icon className="size-[18px]" />
      {item.title}
    </Link>
  )
}

function AccountSection({ stacked, onBeforeLogout }: { stacked?: boolean; onBeforeLogout?: () => void }) {
  const profile = useAuthStore((state) => state.profile)
  const logoutMutation = useLogout()

  const handleLogout = () => {
    onBeforeLogout?.()
    logoutMutation.mutate()
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-xl p-2", stacked && "flex-col items-stretch p-0")}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <User className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {profile?.name ?? "Account"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{profile?.mobile}</p>
        </div>
      </div>
      {stacked ? (
        <Button
          variant="outline"
          className="mt-1"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="size-4" />
          Log out
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          aria-label="Log out"
        >
          <LogOut className="size-4" />
        </Button>
      )}
    </div>
  )
}

/** Desktop-only fixed left sidebar. Hidden below lg -- the mobile top bar
 * covers the same navigation via a slide-out sheet instead. */
function Sidebar() {
  const isActive = useIsActive()

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card px-4 py-5 lg:flex">
      <div className="px-1 pb-6">
        <Brand />
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.url} item={item} active={isActive(item.url)} />
        ))}
      </nav>

      <div className="border-t border-border pt-3">
        <AccountSection />
      </div>
    </aside>
  )
}

/** Mobile/tablet top bar: brand + a hamburger that opens the same nav in a
 * slide-out sheet. Hidden at lg and above, where the Sidebar takes over. */
function MobileTopBar() {
  const isActive = useIsActive()
  const [open, setOpen] = React.useState(false)

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-sm lg:hidden">
      <Brand />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Open menu">
            <Menu className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="flex flex-col gap-6">
          <SheetHeader>
            <SheetTitle>
              <Brand />
            </SheetTitle>
          </SheetHeader>

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.url}
                item={item}
                active={isActive(item.url)}
                onClick={() => setOpen(false)}
              />
            ))}
          </nav>

          <div className="mt-auto border-t border-border pt-4">
            <AccountSection stacked onBeforeLogout={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  )
}
