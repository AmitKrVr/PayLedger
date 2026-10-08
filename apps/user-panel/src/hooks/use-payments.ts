"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { createPayment, getPayment, simulatePayment, type PaymentStatus } from "@/lib/api/payments"

const TERMINAL_STATUSES: PaymentStatus[] = ["SUCCESS", "FAILED", "CANCELLED", "EXPIRED"]

export function useCreatePayment() {
  return useMutation({
    mutationFn: ({ amount, idempotencyKey }: { amount: number; idempotencyKey: string }) =>
      createPayment(amount, idempotencyKey),
  })
}

/** The gateway has no hosted checkout page the browser can visit, so this
 * is the only legitimate way to finish a deposit from the UI -- it never
 * touches the gateway itself, only the backend proxy. */
export function useSimulatePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: "SUCCESS" | "FAILED" }) =>
      simulatePayment(id, outcome),
    onSuccess: (payment) => {
      queryClient.setQueryData(["payments", "detail", payment.id], payment)
      queryClient.invalidateQueries({ queryKey: ["wallet"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
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
