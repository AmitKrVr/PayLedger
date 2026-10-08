"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useSession } from "@/hooks/use-session"
import { useAuthStore } from "@/store/use-auth-store"

/** Wraps /login and /register: an already-authenticated user is bounced
 * straight into the app instead of seeing the guest forms again. */
export function GuestGate({ children }: { children: React.ReactNode }) {
  useSession()
  const status = useAuthStore((state) => state.status)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (status === "authenticated") {
      const from = searchParams.get("from")
      const target = from && from.startsWith("/") && !from.startsWith("//") ? from : "/"
      router.replace(target)
    }
  }, [status, router, searchParams])

  if (status !== "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            {status === "authenticated" ? "Taking you in..." : "Loading..."}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
