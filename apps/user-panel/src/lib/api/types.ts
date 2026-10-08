/** Mirrors apps/backend's response envelope (lib/http.ts's sendSuccess) --
 * every successful response is shaped this way, `data` varies by endpoint. */
export interface ApiSuccess<T> {
  success: true
  code: string
  message: string
  requestId: string
  data: T
}

/** The backend's error envelope (middleware/error.middleware.ts) -- `code`
 * is what callers should branch on, `message` is what to show a human.
 * `errors` is only present on VALIDATION_ERROR responses and carries the
 * actual per-field reason -- `message` alone is just the generic
 * "Validation failed". */
export interface ApiErrorBody {
  success: false
  code: string
  message: string
  errors?: { field: string; message: string }[]
  requestId: string
}

/** Mirrors lib/http.ts's PaginationMeta -- every paginated list endpoint
 * returns exactly this shape. */
export interface PaginationMeta {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface ApiPaginatedSuccess<T> {
  success: true
  code: string
  message: string
  requestId: string
  data: T[]
  meta: PaginationMeta
}

/** Mirrors apps/backend's auth domain (auth.types.ts's AuthUser) -- keep
 * in sync with the backend if those fields change. */
export type UserStatus = "PENDING" | "ACTIVE" | "BLOCKED"

export interface UserProfile {
  id: string
  name: string
  mobile: string
  email: string | null
  status: UserStatus
  createdAt: string
}
