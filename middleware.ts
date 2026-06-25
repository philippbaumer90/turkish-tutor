import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "./auth.config"

// Lightweight, provider-free auth instance for the edge middleware. Only needs
// AUTH_SECRET to decode the session JWT — no Google provider in this bundle.
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isAuthed = !!req.auth
  const isApi = req.nextUrl.pathname.startsWith("/api/")

  if (!isAuthed) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", req.url))
  }
})

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)"],
}
