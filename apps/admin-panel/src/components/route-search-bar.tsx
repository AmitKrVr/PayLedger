"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { CornerDownLeft, FileText, Search, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { getSidebarRoutes, type SidebarRouteItem } from "@/lib/sidebar-routes"

function subscribe() {
  return () => { }
}

function getSnapshot() {
  return (
    typeof navigator !== "undefined" &&
    /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent)
  )
}

function getServerSnapshot() {
  return false
}

function useIsMac() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function RouteSearchBar({ className }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const isMac = useIsMac()

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  const inputRef = React.useRef<HTMLInputElement>(null)
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  // Extract routes from sidebar nav constants
  const allRoutes = React.useMemo(() => getSidebarRoutes(), [])

  const filteredRoutes = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase()

    if (!trimmed) return allRoutes

    return allRoutes
      .map((route) => {
        const title = route.title.toLowerCase()
        const url = route.url.toLowerCase()
        const parent = route.parentTitle?.toLowerCase() ?? ""
        const keywords = route.keywords?.map((k) => k.toLowerCase()) ?? []

        let score = 0

        if (title === trimmed) score += 100
        else if (title.startsWith(trimmed)) score += 80
        else if (title.includes(trimmed)) score += 60

        if (parent.includes(trimmed)) score += 30
        if (keywords.some((k) => k.includes(trimmed))) score += 20
        if (url.includes(trimmed)) score += 10

        return { route, score }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ route }) => route)
  }, [allRoutes, query])

  // Group filtered routes for structured visual presentation
  const groupedRoutes = React.useMemo(() => {
    const groups: {
      category: string
      items: { route: SidebarRouteItem; globalIndex: number }[]
    }[] = []

    filteredRoutes.forEach((route, index) => {
      let group = groups.find((g) => g.category === route.category)
      if (!group) {
        group = { category: route.category, items: [] }
        groups.push(group)
      }
      group.items.push({ route, globalIndex: index })
    })

    return groups
  }, [filteredRoutes])

  // Auto-focus input when dialog opens
  React.useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 20)
    return () => clearTimeout(timer)
  }, [open])

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((prev) => {
          if (prev) {
            setQuery("")
            setSelectedIndex(0)
          }
          return !prev
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Controlled open change handler ensuring query and selection reset on close
  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setQuery("")
      setSelectedIndex(0)
    }
  }, [])

  // Clamp selected index to ensure it is always within range
  const activeIndex =
    filteredRoutes.length > 0
      ? Math.min(Math.max(0, selectedIndex), filteredRoutes.length - 1)
      : 0

  // Keep active item scrolled into view
  React.useEffect(() => {
    if (itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({
        block: "nearest",
      })
    }
  }, [activeIndex])

  // Selection handler: guarantees ZERO full page reloads
  const handleSelect = React.useCallback(
    (route: SidebarRouteItem) => {
      handleOpenChange(false)

      if (route.isPlaceholder || route.url === "#") {
        toast.info(`"${route.title}" is a placeholder item (#)`)
        return
      }

      if (pathname === route.url) {
        // Already on target page; do not trigger duplicate navigation or reload
        return
      }

      // Client-side Next.js route transition
      router.push(route.url)
    },
    [handleOpenChange, pathname, router]
  )

  // Keyboard navigation inside the search input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (filteredRoutes.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredRoutes.length)
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (filteredRoutes.length > 0) {
        setSelectedIndex(
          (prev) => (prev - 1 + filteredRoutes.length) % filteredRoutes.length
        )
      }
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (filteredRoutes.length > 0 && filteredRoutes[activeIndex]) {
        handleSelect(filteredRoutes[activeIndex])
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleOpenChange(false)
    }
  }

  return (
    <>
      {/* Header Search Bar Trigger */}
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className={cn(
          "group relative flex h-8 w-44 sm:w-64 md:w-72 items-center justify-between gap-2 rounded-lg border border-input bg-background/60 px-2.5 text-xs text-muted-foreground shadow-xs transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none cursor-pointer",
          className
        )}
        aria-label="Search sidebar routes (Cmd+K)"
      >
        <div className="flex items-center gap-2 truncate">
          <Search className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
          <span className="truncate">Search routes...</span>
        </div>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border border-border/80 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-90 sm:inline-flex">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {/* Command Palette Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="p-0 gap-0 sm:max-w-xl overflow-hidden rounded-xl border shadow-2xl bg-popover"
        >
          {/* Accessible Title & Description for screen readers */}
          <DialogTitle className="sr-only">Search Sidebar Routes</DialogTitle>
          <DialogDescription className="sr-only">
            Search and navigate to any route available in the sidebar
          </DialogDescription>

          {/* Search Input Bar */}
          <div className="flex items-center border-b px-3 h-12">
            <Search className="size-4 shrink-0 text-muted-foreground mr-2.5" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Type to search sidebar routes..."
              className="flex h-10 w-full rounded-md bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setSelectedIndex(0)
                  inputRef.current?.focus()
                }}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md mr-1.5 transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex h-5 select-none items-center rounded border border-border/80 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Suggestions List */}
          <div className="max-h-80 overflow-y-auto p-2">
            {filteredRoutes.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <p>
                  No routes found for &ldquo;
                  <span className="text-foreground font-medium">{query}</span>
                  &rdquo;
                </p>
                <p className="text-xs mt-1 text-muted-foreground/80">
                  Search only covers routes configured in the sidebar.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {groupedRoutes.map((group) => (
                  <div key={group.category}>
                    <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                      {group.category}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map(({ route, globalIndex }) => {
                        const isSelected = activeIndex === globalIndex

                        return (
                          <button
                            key={route.id}
                            ref={(el) => {
                              itemRefs.current[globalIndex] = el
                            }}
                            type="button"
                            onClick={() => handleSelect(route)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors cursor-pointer select-none outline-none",
                              isSelected
                                ? "bg-accent text-accent-foreground"
                                : "text-foreground hover:bg-muted/60"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="size-4 shrink-0 text-muted-foreground flex items-center justify-center [&_svg]:size-4">
                                {route.icon || <FileText className="size-4" />}
                              </span>
                              <span className="font-medium truncate">
                                {route.title}
                              </span>
                              {route.parentTitle && (
                                <span className="text-xs text-muted-foreground truncate">
                                  in {route.parentTitle}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {route.isPlaceholder ? (
                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                  #
                                </span>
                              ) : (
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {route.url}
                                </span>
                              )}
                              {isSelected && (
                                <CornerDownLeft className="size-3 text-muted-foreground ml-1" />
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Hints */}
          <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
                  ↑
                </kbd>
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
                  ↓
                </kbd>
                navigate
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  ↵
                </kbd>
                select
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  esc
                </kbd>
                close
              </span>
            </div>
            <span className="hidden sm:inline text-[10px]">
              {filteredRoutes.length}{" "}
              {filteredRoutes.length === 1 ? "route" : "routes"}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
