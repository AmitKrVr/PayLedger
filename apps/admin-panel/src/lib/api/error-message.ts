import { isAxiosError } from "axios"

import type { ApiErrorBody } from "./types"

/** Pulls the backend's actual message out of an axios error (see
 * core/exceptions.py's error envelope) -- `error.message` alone would
 * just be axios's generic "Request failed with status code 4xx". */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data
    if (body?.errors?.length) {
      return body.errors.map((fieldError) => fieldError.message).join(" ")
    }
    return body?.message ?? fallback
  }
  return fallback
}
