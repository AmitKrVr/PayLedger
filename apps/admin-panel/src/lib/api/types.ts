/** Mirrors apps/backend's admin auth responses (admin-auth.service.ts's
 * AdminSummary) -- keep in sync with the backend if those fields change. */
export type AdminRole = "ADMIN" | "SUPER_ADMIN"

export interface AdminProfile {
  id: string
  name: string
  email: string
  role: AdminRole
}

/** The backend's response envelope (lib/http.ts's sendSuccess) -- every
 * successful response is shaped this way, `data` varies by endpoint. */
export interface ApiSuccess<T> {
  success: true
  code: string
  message: string
  requestId: string
  data: T
}

/** The backend's error envelope (middleware/error.middleware.ts) --
 * `code` is what callers should branch on, `message` is what to show a
 * human. */
export interface ApiErrorBody {
  success: false
  code: string
  message: string
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
