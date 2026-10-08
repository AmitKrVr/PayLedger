"use client"

import { useQuery } from "@tanstack/react-query"

import { getPayment, type ListPaymentsParams, listPayments } from "@/lib/api/payments"

export function usePaymentsQuery(params: ListPaymentsParams) {
  return useQuery({
    queryKey: ["admin-payments", "list", params],
    queryFn: () => listPayments(params),
    placeholderData: (previous) => previous,
  })
}

export function usePaymentQuery(id: string | null) {
  return useQuery({
    queryKey: ["admin-payments", "detail", id],
    queryFn: () => getPayment(id!),
    enabled: id !== null,
  })
}
