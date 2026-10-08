import { apiClient } from "./client"
import type { AdminProfile, ApiSuccess } from "./types"

export async function login(email: string, password: string): Promise<AdminProfile> {
  const { data } = await apiClient.post<ApiSuccess<AdminProfile>>(
    "/v1/admin/auth/login",
    { email, password }
  )
  return data.data
}

export async function getProfile(): Promise<AdminProfile> {
  const { data } = await apiClient.get<ApiSuccess<AdminProfile>>("/v1/admin/auth/me")
  return data.data
}

export async function logout(): Promise<void> {
  await apiClient.post("/v1/admin/auth/logout")
}
