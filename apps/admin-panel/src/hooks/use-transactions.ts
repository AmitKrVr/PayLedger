"use client"

import { useQuery } from "@tanstack/react-query"

import {
  getTransaction,
  type ListTransactionsParams,
  listTransactions,
} from "@/lib/api/transactions"

export function useTransactionsQuery(params: ListTransactionsParams) {
  return useQuery({
    queryKey: ["admin-transactions", "list", params],
    queryFn: () => listTransactions(params),
    placeholderData: (previous) => previous,
  })
}

export function useTransactionQuery(id: string | null) {
  return useQuery({
    queryKey: ["admin-transactions", "detail", id],
    queryFn: () => getTransaction(id!),
    enabled: id !== null,
  })
}
