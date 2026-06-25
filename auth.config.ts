import type { NextAuthConfig } from "next-auth"

// Edge-safe base config shared by the middleware and the full Node auth instance.
// Crucially it carries NO providers — that keeps the Google provider (and its
// dependencies) out of the middleware bundle that runs on every request.
export const authConfig = {
  pages: { signIn: "/login", error: "/login" },
  providers: [],
} satisfies NextAuthConfig
