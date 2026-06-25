"use client"

import { useEffect, useMemo, useState } from "react"
import TabBar from "@/components/TabBar"
import type { GrammarConcept, Classification } from "@/lib/grammar"
import curriculum from "@/data/curriculum.json"

type Concept = GrammarConcept & { classification: Classification }
type View = "liste" | "phasen"

const PHASE_TITLES: Record<number, string> = Object.fromEntries(
  (curriculum as { phase: number; title: string }[]).map((c) => [c.phase, c.title])
)

function meter(c: Classification): { label: string; color: string; filled: number } {
  if (c === "needsReview") return { label: "wiederholen", color: "#e08a50", filled: 3 }
  if (c === "learned") return { label: "gelernt", color: "#9bb265", filled: 5 }
  return { label: "später", color: "#6f6253", filled: 0 }
}

function Gauge({ filled, color }: { filled: number; color: string }) {
  return (
    <span className="flex items-center gap-[3px]">
      {[1, 2, 3, 4, 5].map((seg) => (
        <span
          key={seg}
          className="w-[7px] h-[7px] rounded-full"
          style={{ background: seg <= filled ? color : "transparent", border: seg <= filled ? "none" : "1.5px solid #3f3429" }}
        />
      ))}
    </span>
  )
}

function ConceptCard({ concept, defaultOpen }: { concept: Concept; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const m = meter(concept.classification)
  const upcoming = concept.classification === "upcoming"
  const first = concept.examples[0]

  return (
    <article
      className={
        "bg-surface border rounded-[16px] overflow-hidden " +
        (concept.classification === "needsReview" ? "border-l-2 border-l-accent border-y-border border-r-border" : "border-border")
      }
      style={upcoming ? { opacity: 0.6 } : undefined}
    >
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[16px] font-extrabold tracking-tight">{concept.name}</span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: m.color }}>
              {m.label}
            </span>
            <Gauge filled={m.filled} color={m.color} />
            <span className={"text-[16px] text-faint transition-transform " + (open ? "rotate-90" : "")}>›</span>
          </span>
        </div>

        <div className="text-[13.5px] text-muted mt-1.5">{concept.form}</div>

        {!open && first && (
          <div className="text-[13px] mt-2">
            <span className="font-semibold text-text-body">{first.tr}</span>
            <span className="text-muted"> — {first.de}</span>
          </div>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 -mt-1">
          <Block label="Bedeutung">{concept.meaning}</Block>
          <Block label="Verwendung">{concept.use}</Block>

          <Eyebrow>Beispiele</Eyebrow>
          <div className="flex flex-col gap-1.5 mt-1.5">
            {concept.examples.map((ex, i) => (
              <div key={i} className="pl-3 border-l-2 border-border">
                <div className="text-[14px] font-semibold text-text-body">{ex.tr}</div>
                <div className="text-[13px] text-muted">{ex.de}</div>
              </div>
            ))}
          </div>

          {concept.pitfall && (
            <div className="mt-3.5">
              <Eyebrow tone="wrong">Stolperfalle</Eyebrow>
              <p className="text-[13.5px] text-text-body mt-1">{concept.pitfall}</p>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function Eyebrow({ children, tone }: { children: React.ReactNode; tone?: "wrong" }) {
  return (
    <div
      className={"text-[11px] font-extrabold uppercase mt-3 " + (tone === "wrong" ? "text-wrong" : "text-faint")}
      style={{ letterSpacing: "0.12em", fontFamily: "'Hanken Grotesk', sans-serif" }}
    >
      {children}
    </div>
  )
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <p className="text-[14px] text-text-body mt-1">{children}</p>
    </div>
  )
}

function SectionLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between px-1 mb-2.5">
      <h2
        className="text-[12px] font-extrabold uppercase text-faint"
        style={{ letterSpacing: "0.12em", fontFamily: "'Hanken Grotesk', sans-serif" }}
      >
        {label}
      </h2>
      {sub && <span className="text-[12px] font-semibold text-faint">{sub}</span>}
    </div>
  )
}

export default function GrammarPage() {
  const [concepts, setConcepts] = useState<Concept[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>("liste")
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetch("/api/grammar")
      .then((r) => (r.ok ? r.json() : { concepts: [] }))
      .then((d) => {
        const list: Concept[] = d.concepts ?? []
        setConcepts(list)
        // Phasen view starts with fully-upcoming phases collapsed.
        const byPhase = new Map<number, Concept[]>()
        for (const c of list) {
          if (c.classification === "needsReview") continue
          ;(byPhase.get(c.phase) ?? byPhase.set(c.phase, []).get(c.phase)!).push(c)
        }
        const upcomingPhases = Array.from(byPhase.entries())
          .filter(([, cs]) => cs.every((c) => c.classification === "upcoming"))
          .map(([p]) => p)
        setCollapsed(new Set(upcomingPhases))
      })
      .finally(() => setLoading(false))
  }, [])

  const review = useMemo(() => (concepts ?? []).filter((c) => c.classification === "needsReview"), [concepts])
  const phases = useMemo(() => {
    // Concepts grouped by phase, excluding the ones pulled into "Zu wiederholen".
    const rest = (concepts ?? []).filter((c) => c.classification !== "needsReview")
    const byPhase = new Map<number, Concept[]>()
    for (const c of rest) (byPhase.get(c.phase) ?? byPhase.set(c.phase, []).get(c.phase)!).push(c)
    return Array.from(byPhase.keys()).sort((a, b) => a - b).map((p) => ({ phase: p, concepts: byPhase.get(p)! }))
  }, [concepts])

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-muted animate-dotpulse" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      </div>
    )
  }

  const togglePhase = (p: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })

  return (
    <div className="relative min-h-[100dvh] bg-bg flex flex-col w-full max-w-md desk:max-w-[640px] mx-auto px-0 pt-safe md:border-x md:border-border desk:border-x-0 pb-[88px] desk:pb-10">
      {/* Header */}
      <div className="px-[26px] pt-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Grammatik</h1>
          <p className="text-[13px] font-medium text-muted mt-1">Form · Bedeutung · Verwendung</p>
        </div>
        <div className="inline-flex bg-surface border border-border rounded-pill p-1">
          {(["liste", "phasen"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={
                "px-3.5 py-1.5 rounded-pill text-[13px] font-bold capitalize transition-colors " +
                (view === v ? "bg-accent text-on-accent" : "text-muted")
              }
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-7">
        {/* Zu wiederholen — hidden entirely when empty */}
        {review.length > 0 && (
          <section className="px-[22px]">
            <SectionLabel label="Zu wiederholen" sub={`${review.length}`} />
            <div className="flex flex-col gap-2.5">
              {review.map((c) => (
                <ConceptCard key={c.id} concept={c} defaultOpen />
              ))}
            </div>
          </section>
        )}

        {/* Phase groups */}
        {phases.map(({ phase, concepts }) => {
          const isCollapsed = view === "phasen" && collapsed.has(phase)
          return (
            <section key={phase} className="px-[22px]">
              {view === "phasen" ? (
                <button onClick={() => togglePhase(phase)} className="w-full">
                  <SectionLabel
                    label={`Phase ${phase}`}
                    sub={`${PHASE_TITLES[phase] ?? ""}  ${isCollapsed ? "›" : "⌄"}`}
                  />
                </button>
              ) : (
                <SectionLabel label={`Phase ${phase}`} sub={PHASE_TITLES[phase] ?? ""} />
              )}
              {!isCollapsed && (
                <div className="flex flex-col gap-2.5">
                  {concepts.map((c) => (
                    <ConceptCard key={c.id} concept={c} defaultOpen={false} />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <TabBar />
    </div>
  )
}
