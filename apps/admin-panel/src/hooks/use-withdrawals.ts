"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  approveWithdrawal,
  type ListWithdrawalsParams,
  listWithdrawals,
  rejectWithdrawal,
} from "@/lib/api/withdrawals"

export function useWithdrawalsQuery(params: ListWithdrawalsParams) {
  return useQuery({
    queryKey: ["withdrawals", "list", params],
    queryFn: () => listWithdrawals(params),
    placeholderData: (previous) => previous, // keep the table visible while the next page/filter loads
  })
}

export function useApproveWithdrawal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => approveWithdrawal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals", "list"] })
    },
  })
}

export function useRejectWithdrawal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectWithdrawal(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals", "list"] })
    },
  })
}
