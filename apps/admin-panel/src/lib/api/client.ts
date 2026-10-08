import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios"

import { queryClient } from "@/lib/query-client"
import { useAuthStore } from "@/store/use-auth-store"

import type { ApiErrorBody } from "./types"

const baseURL = process.env.NEXT_PUBLIC_API_URL

if (!baseURL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set")
}

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
})

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
}

let refreshPromise: Promise<unknown> | null = null

function refreshOnce() {
  refreshPromise ??= axios
    .post(`${baseURL}/v1/admin/auth/refresh`, null, { withCredentials: true })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetryableConfig | undefined
    const code = error.response?.data?.code

    if (error.response?.status !== 401 || !config) {
      return Promise.reject(error)
    }

    // INVALID_TOKEN (expired/malformed access token) and UNAUTHORIZED
    // (no access-token cookie at all -- the normal case once it has
    // simply expired and the browser dropped it) both mean "the access
    // token is unusable, but the refresh token might still be good."
    // Retry once after a refresh; INVALID_REFRESH_TOKEN surfacing from
    // a direct call means there's genuinely no session, so that one
    // still falls through to the logout below.
    if (
      (code === "INVALID_TOKEN" || code === "UNAUTHORIZED") &&
      !config._retried
    ) {
      config._retried = true
      try {
        await refreshOnce()
        return apiClient(config)
      } catch (refreshErr) {
        // Refresh itself failed -- the session is genuinely over.
        useAuthStore.getState().clear()
        queryClient.clear()
        return Promise.reject(refreshErr)
      }
    }

    useAuthStore.getState().clear()
    queryClient.clear()

    return Promise.reject(error)
  }
)
