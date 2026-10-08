"use client"

import { useMutation } from "@tanstack/react-query"

import { createWithdrawal } from "@/lib/api/withdrawals"

export function useCreateWithdrawal() {
  return useMutation({
    mutationFn: ({ amount, idempotencyKey }: { amount: number; idempotencyKey: string }) =>
      createWithdrawal(amount, idempotencyKey),
  })
}
