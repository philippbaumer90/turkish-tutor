"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// Mobile-only bottom navigation. On desktop (≥900px) the AppSidebar is the nav,
// so this is hidden via `desk:hidden`. Rendered per-page on the three reference
// tabs (Lernen / Vokabeln / Grammatik) — NOT on /session or /login, so there's
// no nav escape mid-drill.

const TABS = [
  { href: "/", label: "Lernen", icon: HomeIcon },
  { href: "/vocab", label: "Vokabeln", icon: BookIcon },
  { href: "/grammar", label: "Grammatik", icon: GrammarIcon },
] as const

export default function TabBar() {
  const pathname = usePathname()

  return (
    <nav className="desk:hidden fixed bottom-0 left-0 right-0 z-20 w-full max-w-md mx-auto bg-surface border-t border-border md:border-x md:border-border pb-safe">
      <div className="flex">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                "flex-1 flex flex-col items-center gap-1 pt-2.5 pb-2 " +
                (active ? "text-accent" : "text-faint")
              }
            >
              <Icon active={active} />
              <span className="text-[11px] font-bold tracking-tight">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  )
}

function BookIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v16H5.5A1.5 1.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A1.5 1.5 0 0 1 5.5 19H19" />
    </svg>
  )
}

function GrammarIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M4 12h10" />
      <path d="M4 17h13" />
    </svg>
  )
}
