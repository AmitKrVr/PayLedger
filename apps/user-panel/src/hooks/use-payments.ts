"use client"

import { useMutation, useQuery } from "@tanstack/react-query"

import { createPayment, getPayment, type PaymentStatus } from "@/lib/api/payments"

const TERMINAL_STATUSES: PaymentStatus[] = ["SUCCESS", "FAILED", "CANCELLED", "EXPIRED"]

export function useCreatePayment() {
  return useMutation({
    mutationFn: ({ amount, idempotencyKey }: { amount: number; idempotencyKey: string }) =>
      createPayment(amount, idempotencyKey),
  })
}

/** Polls the payment's status until it reaches a terminal state. The
 * Fake Payment Gateway's webhook (triggered externally) is what actually
 * completes it -- this panel only ever creates the payment and watches
 * PayLedger's own record of it, never the gateway directly. */
export function usePaymentStatusQuery(id: string | null) {
  return useQuery({
    queryKey: ["payments", "detail", id],
    queryFn: () => getPayment(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status || TERMINAL_STATUSES.includes(status)) {
        return false
      }
      return 3000
    },
  })
}
