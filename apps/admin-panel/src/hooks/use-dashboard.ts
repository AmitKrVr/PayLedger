"use client"

import { useQuery } from "@tanstack/react-query"

import { getDashboard } from "@/lib/api/dashboard"

export function useDashboardQuery() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  })
}
