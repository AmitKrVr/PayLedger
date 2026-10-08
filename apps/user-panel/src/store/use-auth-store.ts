import { create } from "zustand"

import type { UserProfile } from "@/lib/api/types"

export type SessionStatus = "loading" | "authenticated" | "unauthenticated"

interface AuthState {
  profile: UserProfile | null
  status: SessionStatus
  setProfile: (profile: UserProfile) => void
  clear: () => void
}

/** The single source of truth for "who is logged in" on the client.
 * Deliberately in-memory only -- no persist middleware, no
 * localStorage/sessionStorage. Tokens never enter this store (or any
 * JS at all): they live only in httpOnly cookies the browser manages.
 * This store is re-populated from the server on every full page load
 * via useSession(), and updated by the login/register/logout mutations
 * and the axios response interceptor (lib/api/client.ts) in between. */
export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  status: "loading",
  setProfile: (profile) => set({ profile, status: "authenticated" }),
  clear: () => set({ profile: null, status: "unauthenticated" }),
}))
