"use client"

import { useQuery } from "@tanstack/react-query"

import { getUser, type ListUsersParams, listUsers } from "@/lib/api/users"

export function useUsersQuery(params: ListUsersParams) {
  return useQuery({
    queryKey: ["users", "list", params],
    queryFn: () => listUsers(params),
    placeholderData: (previous) => previous,
  })
}

export function useUserQuery(id: string | null) {
  return useQuery({
    queryKey: ["users", "detail", id],
    queryFn: () => getUser(id!),
    enabled: id !== null,
  })
}
