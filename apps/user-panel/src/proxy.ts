import { NextResponse, type NextRequest } from "next/server"

const REFRESH_COOKIE_NAME = "refresh_token"
const GUEST_PATHS = new Set(["/login", "/register"])

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isAuthenticated = request.cookies.has(REFRESH_COOKIE_NAME)
  const isGuestPage = GUEST_PATHS.has(pathname)

  if (!isGuestPage && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url)
    const fromPath = pathname + search
    if (fromPath && fromPath !== "/") {
      loginUrl.searchParams.set("from", fromPath)
    }
    return NextResponse.redirect(loginUrl)
  }

  if (isGuestPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons).*)"],
}
