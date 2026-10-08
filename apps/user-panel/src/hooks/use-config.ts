"use client"

import { useQuery } from "@tanstack/react-query"

import { getLimits } from "@/lib/api/config"

export function useLimitsQuery() {
  return useQuery({
    queryKey: ["config", "limits"],
    queryFn: getLimits,
    staleTime: 10 * 60 * 1000, // these change only with a backend deploy
  })
}
