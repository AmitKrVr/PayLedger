"use client"

import { useMutation } from "@tanstack/react-query"

import { createTransfer, lookupRecipient } from "@/lib/api/transfers"

export function useLookupRecipient() {
  return useMutation({
    mutationFn: (mobile: string) => lookupRecipient(mobile),
  })
}

export function useCreateTransfer() {
  return useMutation({
    mutationFn: ({
      recipientUserId,
      amount,
      idempotencyKey,
    }: {
      recipientUserId: string
      amount: number
      idempotencyKey: string
    }) => createTransfer(recipientUserId, amount, idempotencyKey),
  })
}
