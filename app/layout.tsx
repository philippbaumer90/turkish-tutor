import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Türkisch · Tutor",
  description: "Persönlicher Türkisch-Tutor mit Spaced Repetition",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
