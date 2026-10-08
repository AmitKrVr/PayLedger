"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useSession } from "@/hooks/use-session"
import { useAuthStore } from "@/store/use-auth-store"

export function SessionGate({ children }: { children: React.ReactNode }) {
  useSession()
  const status = useAuthStore((state) => state.status)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (status === "unauthenticated") {
      const searchStr = searchParams.toString()
      const currentPath = searchStr ? `${pathname}?${searchStr}` : pathname
      if (currentPath && currentPath !== "/") {
        router.replace(`/login?from=${encodeURIComponent(currentPath)}`)
      } else {
        router.replace("/login")
      }
    }
  }, [status, router, pathname, searchParams])

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            {status === "unauthenticated" ? "Redirecting to login..." : "Verifying session..."}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
