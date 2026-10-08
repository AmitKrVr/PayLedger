"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { register } from "@/lib/api/auth"
import type { RegisterFormData } from "@/lib/schema"
import { useAuthStore } from "@/store/use-auth-store"

export function useRegister() {
  const router = useRouter()
  const setProfile = useAuthStore((state) => state.setProfile)

  return useMutation({
    mutationFn: (data: RegisterFormData) =>
      register({
        name: data.name,
        mobile: data.mobile,
        email: data.email || undefined,
        password: data.password,
      }),
    onSuccess: (profile) => {
      // Registration already establishes the session (backend sets the
      // same auth cookies as login) -- go straight into the app.
      setProfile(profile)
      router.push("/")
    },
  })
}
