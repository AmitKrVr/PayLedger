import { NextResponse, type NextRequest } from "next/server"

// PayLedger's backend sets this same cookie name for both user and admin
// sessions (role is distinguished by the JWT payload, not the cookie
// name) -- this app only ever logs in as an admin, so its presence here
// is a reasonable proxy for "an admin session might exist" ahead of the
// real check (requireAdminAuth on the backend, via useSession()).
const REFRESH_COOKIE_NAME = "refresh_token"
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

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons).*)"],
}
