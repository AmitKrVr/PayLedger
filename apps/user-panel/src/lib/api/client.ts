import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios"

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
    .post(`${baseURL}/v1/auth/refresh`, null, { withCredentials: true })
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

    // INVALID_TOKEN -- an expired/malformed access token on an
    // otherwise-live session. Retry once after a refresh. Any other
    // 401 (UNAUTHORIZED: no cookie at all, or INVALID_REFRESH_TOKEN
    // surfacing from a direct call) means there's no session to
    // refresh, so just end it below.
    if (code === "INVALID_TOKEN" && !config._retried) {
      config._retried = true
      try {
        await refreshOnce()
        return apiClient(config)
      } catch (refreshErr) {
        // Refresh itself failed -- the session is genuinely over.
        useAuthStore.getState().clear()
        return Promise.reject(refreshErr)
      }
    }

    useAuthStore.getState().clear()

    return Promise.reject(error)
  }
)
