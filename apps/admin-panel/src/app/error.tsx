"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // TODO: wire to a real error-reporting service once one exists --
    // console.error is the only sink today.
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center justify-center gap-6 text-center max-w-md">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-full bg-muted p-6">
            <AlertTriangle className="size-12 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">
              Something went wrong
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              An unexpected error occurred. You can try again, or head back to
              the dashboard.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="lg" onClick={reset}>
            Try again
          </Button>
          <Button variant="default" size="lg" onClick={() => router.push("/")}>
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
