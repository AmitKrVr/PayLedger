import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

export function Field({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col gap-1.5", className)}>{children}</div>
}

export function FieldLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof Label>) {
  return <Label className={className} {...props} />
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return (
    <p className="text-xs text-destructive" role="alert">
      {children}
    </p>
  )
}
