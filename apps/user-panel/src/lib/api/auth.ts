import { apiClient } from "./client"
import type { ApiSuccess, UserProfile } from "./types"

export interface RegisterPayload {
  name: string
  mobile: string
  email?: string
  password: string
}

export interface LoginPayload {
  mobile: string
  password: string
}

export async function register(payload: RegisterPayload): Promise<UserProfile> {
  const { data } = await apiClient.post<ApiSuccess<UserProfile>>(
    "/v1/auth/register",
    payload
  )
  return data.data
}

export async function login(payload: LoginPayload): Promise<UserProfile> {
  const { data } = await apiClient.post<ApiSuccess<UserProfile>>(
    "/v1/auth/login",
    payload
  )
  return data.data
}

export async function getProfile(): Promise<UserProfile> {
  const { data } = await apiClient.get<ApiSuccess<UserProfile>>("/v1/auth/me")
  return data.data
}

export async function logout(): Promise<void> {
  await apiClient.post("/v1/auth/logout")
}
