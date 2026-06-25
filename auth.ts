import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const ALLOWED = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    signIn({ user }) {
      const email = (user.email ?? "").toLowerCase()
      return ALLOWED.includes(email)
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
