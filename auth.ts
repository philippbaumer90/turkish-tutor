import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { authConfig } from "./auth.config"

const ALLOWED = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

// Full instance (Node runtime only) — providers + secrets live here, never in
// the middleware. Used by the /api/auth handlers and route-level auth() checks.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    signIn({ user }) {
      const email = (user.email ?? "").toLowerCase()
      return ALLOWED.includes(email)
    },
  },
})
