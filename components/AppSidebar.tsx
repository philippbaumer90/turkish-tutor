"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSidebar } from "@/components/SidebarProvider"
import { PHASE_SHORT_LABELS } from "@/lib/prompt"

const SECTIONS = [
  { href: "/", label: "Lernen" },
  { href: "/vocab", label: "Vokabeln" },
  { href: "/grammar", label: "Grammatik" },
] as const

export default function AppSidebar() {
  const { streak, phase } = useSidebar()
  const pathname = usePathname()

  return (
    <aside className="hidden desk:flex desk:flex-col w-[316px] shrink-0 h-[100dvh] sticky top-0 bg-[#1a140e] border-r border-border px-7 pt-9 pb-7">
      {/* Brand */}
      <div>
        <div
          className="text-[11px] font-extrabold uppercase text-faint"
          style={{ letterSpacing: "0.16em", fontFamily: "'Hanken Grotesk', sans-serif" }}
        >
          Türkisch
        </div>
        <div className="text-[22px] font-extrabold tracking-tight mt-1">Dein Tutor</div>
      </div>

      {/* Streak pill */}
      <span className="self-start mt-5 text-[14px] font-extrabold text-on-accent bg-accent px-[15px] py-[9px] rounded-pill">
        {streak}-Tage-Streak
      </span>

      {/* Section nav */}
      <nav className="flex flex-col gap-1 mt-7">
        {SECTIONS.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                "px-3 py-2.5 rounded-input text-[15px] " +
                (active
                  ? "bg-surface-raised text-text font-extrabold"
                  : "text-muted font-semibold hover:text-text")
              }
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Lessons */}
      <div
        className="text-[11px] font-extrabold uppercase text-faint mt-8 mb-3 px-1"
        style={{ letterSpacing: "0.16em" }}
      >
        Lektionen
      </div>
      <nav className="flex flex-col gap-1">
        {PHASE_SHORT_LABELS.map((label, i) => {
          const status = i < phase ? "done" : i === phase ? "current" : "upcoming"
          return (
            <div
              key={i}
              aria-current={status === "current" ? "step" : undefined}
              className={
                "flex items-center gap-3 px-3 py-2.5 rounded-input " +
                (status === "current" ? "bg-surface-raised" : "")
              }
            >
              {/* Badge */}
              {status === "done" ? (
                <span
                  className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[13px] font-extrabold text-correct"
                  style={{ background: "rgba(155,178,101,.13)", border: "1.5px solid rgba(155,178,101,.45)" }}
                >
                  ✓
                </span>
              ) : status === "current" ? (
                <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12px] font-extrabold bg-accent text-on-accent">
                  {i + 1}
                </span>
              ) : (
                <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12px] font-extrabold text-faint border border-border">
                  {i + 1}
                </span>
              )}

              {/* Label */}
              <span
                className={
                  "text-[14.5px] " +
                  (status === "current"
                    ? "text-text font-extrabold"
                    : status === "done"
                    ? "text-text-body font-semibold"
                    : "text-muted font-semibold")
                }
              >
                {label}
              </span>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
