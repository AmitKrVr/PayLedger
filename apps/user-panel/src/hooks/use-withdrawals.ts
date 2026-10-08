"use client"

import { useMutation, useQuery } from "@tanstack/react-query"

import {
  createWithdrawal,
  getWithdrawal,
  type ListWithdrawalsParams,
  listWithdrawals,
} from "@/lib/api/withdrawals"

export function useCreateWithdrawal() {
  return useMutation({
    mutationFn: ({ amount, idempotencyKey }: { amount: number; idempotencyKey: string }) =>
      createWithdrawal(amount, idempotencyKey),
  })
}

export function useWithdrawalsQuery(params: ListWithdrawalsParams) {
  return useQuery({
    queryKey: ["withdrawals", "list", params],
    queryFn: () => listWithdrawals(params),
    placeholderData: (previous) => previous,
  })
}

export function useWithdrawalQuery(id: string | null) {
  return useQuery({
    queryKey: ["withdrawals", "detail", id],
    queryFn: () => getWithdrawal(id!),
    enabled: id !== null,
  })
}
