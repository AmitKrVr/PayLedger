"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"

import { login } from "@/lib/api/auth"
import type { LoginFormData } from "@/lib/schema"
import { useAuthStore } from "@/store/use-auth-store"

export function useLogin() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setProfile = useAuthStore((state) => state.setProfile)

  return useMutation({
    mutationFn: (data: LoginFormData) => login(data),
    onSuccess: (profile) => {
      setProfile(profile)
      const from = searchParams.get("from")
      const target = from && from.startsWith("/") && !from.startsWith("//") ? from : "/"
      router.push(target)
    },
  })
}
