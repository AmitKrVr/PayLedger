import { isAxiosError } from "axios"

import type { ApiErrorBody } from "./types"

/** Pulls the backend's actual message out of an axios error -- `error.message`
 * alone would just be axios's generic "Request failed with status code 4xx". */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? fallback
  }
  return fallback
}

export function getApiErrorCode(error: unknown): string | undefined {
  if (isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.code
  }
  return undefined
}
