"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { logout } from "@/lib/api/auth"
import { useAuthStore } from "@/store/use-auth-store"

export function useLogout() {
  const clear = useAuthStore((state) => state.clear)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    // Clear local state whether or not the network call succeeded --
    // someone clicking "log out" expects to end up logged out on this
    // device regardless of a transient network failure. SessionGate
    // reacts to the resulting `unauthenticated` status and does the
    // actual navigation to /login, so this hook doesn't need to (and
    // shouldn't -- keeping that in one place).
    onSettled: () => {
      clear()
      queryClient.clear()
    },
  })
}
