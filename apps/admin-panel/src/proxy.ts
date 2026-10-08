import { NextResponse, type NextRequest } from "next/server"

const REFRESH_COOKIE_NAME = "admin_refresh_token"
const LOGIN_PATH = "/login"

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isAuthenticated = request.cookies.has(REFRESH_COOKIE_NAME)
  const isLoginPage = pathname === LOGIN_PATH

  if (!isLoginPage && !isAuthenticated) {
    const loginUrl = new URL(LOGIN_PATH, request.url)
    const fromPath = pathname + search
    if (fromPath && fromPath !== "/") {
      loginUrl.searchParams.set("from", fromPath)
    }
    return NextResponse.redirect(loginUrl)
  }

  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons).*)"],
}
