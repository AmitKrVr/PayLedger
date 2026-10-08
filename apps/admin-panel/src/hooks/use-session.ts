"use client"

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"

import { getProfile } from "@/lib/api/auth"
import { useAuthStore } from "@/store/use-auth-store"

export function useSession(): void {
  const status = useAuthStore((state) => state.status)
  const setProfile = useAuthStore((state) => state.setProfile)

  const { data, isSuccess } = useQuery({
    queryKey: ["me"],
    queryFn: getProfile,
    enabled: status !== "unauthenticated",
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  useEffect(() => {
    if (isSuccess && data) {
      setProfile(data)
    }
  }, [isSuccess, data, setProfile])
}
