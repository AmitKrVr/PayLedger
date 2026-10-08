"use client"

import { useQuery } from "@tanstack/react-query"

import { getWallet } from "@/lib/api/wallet"

export function useWalletQuery() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: getWallet,
  })
}
