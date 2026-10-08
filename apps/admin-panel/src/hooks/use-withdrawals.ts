"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  approveWithdrawal,
  getWithdrawal,
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

export function useWithdrawalQuery(id: string | null) {
  return useQuery({
    queryKey: ["withdrawals", "detail", id],
    queryFn: () => getWithdrawal(id!),
    enabled: id !== null,
  })
}

export function useApproveWithdrawal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => approveWithdrawal(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals", "list"] })
      queryClient.invalidateQueries({ queryKey: ["withdrawals", "detail", id] })
    },
  })
}

export function useRejectWithdrawal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectWithdrawal(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals", "list"] })
      queryClient.invalidateQueries({ queryKey: ["withdrawals", "detail", id] })
    },
  })
}
