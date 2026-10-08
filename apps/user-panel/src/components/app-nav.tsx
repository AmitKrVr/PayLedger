"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeftRight, Home, Landmark, LogOut, Menu, Receipt, User, Wallet } from "lucide-react"

import { useLogout } from "@/hooks/use-logout"
import { useAuthStore } from "@/store/use-auth-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

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
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
        P
      </span>
      <span className="text-base font-semibold text-foreground">PayLedger</span>
    </Link>
  )
}

export function AppNav() {
  const pathname = usePathname()
  const profile = useAuthStore((state) => state.profile)
  const logoutMutation = useLogout()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const isActive = (url: string) => pathname === url || pathname.startsWith(`${url}/`)

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Brand />

        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                isActive(item.url)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <User className="size-3.5" />
                  </span>
                  <span className="max-w-32 truncate">{profile?.name ?? "Account"}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>{profile?.mobile}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => logoutMutation.mutate()}
                  className="text-destructive"
                >
                  <LogOut className="size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="md:hidden" aria-label="Open menu">
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
                  <Link
                    key={item.url}
                    href={item.url}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive(item.url)
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.title}
                  </Link>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
                {profile && (
                  <div className="px-1">
                    <p className="text-sm font-medium text-foreground">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">{profile.mobile}</p>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setMobileOpen(false)
                    logoutMutation.mutate()
                  }}
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="size-4" />
                  Log out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
