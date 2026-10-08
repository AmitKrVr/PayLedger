"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getTransfer,
  type ListTransfersParams,
  listTransfers,
  reverseTransfer,
} from "@/lib/api/transfers"

export function useTransfersQuery(params: ListTransfersParams) {
  return useQuery({
    queryKey: ["transfers", "list", params],
    queryFn: () => listTransfers(params),
    placeholderData: (previous) => previous,
  })
}

export function useTransferQuery(id: string | null) {
  return useQuery({
    queryKey: ["transfers", "detail", id],
    queryFn: () => getTransfer(id!),
    enabled: id !== null,
  })
}

export function useReverseTransfer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => reverseTransfer(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["transfers", "list"] })
      queryClient.invalidateQueries({ queryKey: ["transfers", "detail", id] })
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
