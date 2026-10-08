import type React from "react"
import { nav } from "@/constants/nav"

export interface SidebarRouteItem {
  id: string
  title: string
  url: string
  icon?: React.ReactNode
  category: "Main Navigation"
  parentTitle?: string
  keywords?: string[]
  isPlaceholder: boolean
}

/** Extracts all searchable routes directly from the sidebar configuration. */
export function getSidebarRoutes(): SidebarRouteItem[] {
  const routes: SidebarRouteItem[] = []

  for (const item of nav.navMain) {
    routes.push({
      id: `main-${item.title}-${item.url}`,
      title: item.title,
      url: item.url,
      icon: item.icon,
      category: "Main Navigation",
      isPlaceholder: !item.url || item.url === "#",
    })
  }

  return routes
}
