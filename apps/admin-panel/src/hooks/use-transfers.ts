"use client"

import { useMutation } from "@tanstack/react-query"

import { reverseTransfer } from "@/lib/api/transfers"

export function useReverseTransfer() {
  return useMutation({
    mutationFn: (id: string) => reverseTransfer(id),
  })
}
