"use client"

import * as React from "react"
import { RotateCw } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

export interface RefreshButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "children"> {
  isRefreshing?: boolean
  label?: React.ReactNode
  refreshingLabel?: React.ReactNode
  showIcon?: boolean
  children?: React.ReactNode
}

export function RefreshButton({
  isRefreshing = false,
  label = "Refresh",
  refreshingLabel = "Refreshing",
  showIcon = true,
  variant = "outline",
  size = "sm",
  className,
  disabled,
  children,
  ...props
}: RefreshButtonProps) {
  const isBusy = Boolean(isRefreshing)

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || isBusy}
      className={cn(
        "h-9 px-3.5 text-xs font-medium cursor-pointer gap-2 border-border hover:bg-accent text-foreground transition-colors",
        className
      )}
      {...props}
    >
      {showIcon && (
        <RotateCw className={cn("size-3.5", isBusy && "animate-spin")} />
      )}
      {children ?? <span>{isBusy ? refreshingLabel : label}</span>}
    </Button>
  )
}
