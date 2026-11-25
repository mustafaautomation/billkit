import { NextResponse, type NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete("x-billkit-surface")
  const { pathname } = request.nextUrl
  if (pathname === "/demo" || pathname.startsWith("/demo/")) {
    requestHeaders.set("x-billkit-surface", "demo")
  }
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
}
