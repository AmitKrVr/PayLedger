import * as React from "react"
import { cn } from "cn"

export interface PageHeaderProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  title?: React.ReactNode
  description?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  back?: React.ReactNode
  actionsClassName?: string
}

export function PageHeaderTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "text-2xl font-bold tracking-tight text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </h1>
  )
}

export function PageHeaderDescription({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  )
}

export function PageHeaderActions({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2.5 sm:shrink-0", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  badge,
  actions,
  back,
  className,
  actionsClassName,
  children,
  ...props
}: PageHeaderProps) {
  const hasDirectProps = Boolean(title || description || badge || actions || back)

  if (!hasDirectProps) {
    return (
      <div
        className={cn(
          "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-3", className)} {...props}>
      {back && <div>{back}</div>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {(title || description || badge) && (
          <div>
            {title && (
              badge ? (
                <div className="flex items-center gap-2.5">
                  {typeof title === "string" ? (
                    <PageHeaderTitle>{title}</PageHeaderTitle>
                  ) : (
                    title
                  )}
                  {badge}
                </div>
              ) : (
                <div>
                  {typeof title === "string" ? (
                    <PageHeaderTitle>{title}</PageHeaderTitle>
                  ) : (
                    title
                  )}
                </div>
              )
            )}
            {description && (
              typeof description === "string" ? (
                <PageHeaderDescription>{description}</PageHeaderDescription>
              ) : (
                description
              )
            )}
          </div>
        )}
        {actions && (
          <PageHeaderActions className={actionsClassName}>
            {actions}
          </PageHeaderActions>
        )}
      </div>
      {children}
    </div>
  )
}

export interface PageLayoutProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  title?: React.ReactNode
  description?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  back?: React.ReactNode
  headerClassName?: string
  actionsClassName?: string
  header?: React.ReactNode
}

export function PageLayout({
  title,
  description,
  badge,
  actions,
  back,
  headerClassName,
  actionsClassName,
  header,
  className,
  children,
  ...props
}: PageLayoutProps) {
  const hasHeaderProps = Boolean(title || description || badge || actions || back)

  return (
    <div
      className={cn("flex flex-col gap-4 mx-auto w-full", className)}
      {...props}
    >
      {header ? (
        header
      ) : hasHeaderProps ? (
        <PageHeader
          title={title}
          description={description}
          badge={badge}
          actions={actions}
          back={back}
          className={headerClassName}
          actionsClassName={actionsClassName}
        />
      ) : null}
      {children}
    </div>
  )
}

export const PageContainer = PageLayout

export { RefreshButton, type RefreshButtonProps } from "@/components/refresh-button"
