"use client"

import { useQuery } from "@tanstack/react-query"

import { getTransaction, type ListTransactionsParams, listTransactions } from "@/lib/api/transactions"

export function useTransactionsQuery(params: ListTransactionsParams) {
  return useQuery({
    queryKey: ["transactions", "list", params],
    queryFn: () => listTransactions(params),
    placeholderData: (previous) => previous, // keep the list visible while the next page/filter loads
  })
}

export function useTransactionQuery(id: string | null) {
  return useQuery({
    queryKey: ["transactions", "detail", id],
    queryFn: () => getTransaction(id!),
    enabled: id !== null,
  })
}
