"use client"

import { useEffect, useMemo, useState } from "react"
import TabBar from "@/components/TabBar"
import { TOPICS } from "@/lib/topics"
import type { VocabCard } from "@/lib/srs"
import curriculum from "@/data/curriculum.json"

type Card = VocabCard & { isDue: boolean }
type Grouping = "topic" | "lesson"
type View = "karten" | "kompakt"

const PHASE_TITLES: Record<number, string> = Object.fromEntries(
  (curriculum as { phase: number; title: string }[]).map((c) => [c.phase, c.title])
)

// label + colour come from isDue first, then box (handoff §4).
function strength(card: Card): { label: string; color: string } {
  if (card.isDue) return { label: "auffrischen", color: "#e08a50" }
  if (card.box >= 4) return { label: "sitzt", color: "#9bb265" }
  if (card.box <= 1) return { label: "neu", color: "#6f6253" }
  return { label: "im Aufbau", color: "#a89784" }
}

function StrengthMeter({ box, color }: { box: number; color: string }) {
  return (
    <span className="flex items-center gap-[3px]">
      {[1, 2, 3, 4, 5].map((seg) => (
        <span
          key={seg}
          className="w-[7px] h-[7px] rounded-full"
          style={{ background: seg <= box ? color : "transparent", border: seg <= box ? "none" : "1.5px solid #3f3429" }}
        />
      ))}
    </span>
  )
}

function RelChip({ kind, txt }: { kind: "syn" | "ant"; txt: string }) {
  const isSyn = kind === "syn"
  return (
    <span
      className="text-[12px] font-semibold px-2 py-[3px] rounded-pill border"
      style={{
        color: isSyn ? "#9bb265" : "#d96a52",
        borderColor: isSyn ? "rgba(155,178,101,.35)" : "rgba(217,106,82,.35)",
      }}
    >
      {isSyn ? "≈ " : "≠ "}
      {txt}
    </span>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex bg-surface border border-border rounded-pill p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={
            "px-3.5 py-1.5 rounded-pill text-[13px] font-bold transition-colors " +
            (value === o.value ? "bg-accent text-on-accent" : "text-muted")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

type Group = { key: string; label: string; sub: string; words: Card[] }

function groupCards(cards: Card[], grouping: Grouping): Group[] {
  if (grouping === "topic") {
    const order = [...TOPICS]
    const byTopic = new Map<string, Card[]>()
    for (const c of cards) {
      const t = c.topic && order.includes(c.topic as (typeof TOPICS)[number]) ? c.topic : "Sonstiges"
      ;(byTopic.get(t) ?? byTopic.set(t, []).get(t)!).push(c)
    }
    return order
      .filter((t) => byTopic.has(t))
      .map((t) => ({
        key: t,
        label: t,
        sub: `${byTopic.get(t)!.length} ${byTopic.get(t)!.length === 1 ? "Wort" : "Wörter"}`,
        words: byTopic.get(t)!,
      }))
  }

  // by lesson / phase — phase-less words go to an explicit bucket at the end
  const byPhase = new Map<number, Card[]>()
  const noPhase: Card[] = []
  for (const c of cards) {
    if (typeof c.phase === "number") {
      ;(byPhase.get(c.phase) ?? byPhase.set(c.phase, []).get(c.phase)!).push(c)
    } else {
      noPhase.push(c)
    }
  }
  const groups: Group[] = Array.from(byPhase.keys())
    .sort((a, b) => a - b)
    .map((p) => ({
      key: `phase-${p}`,
      label: `Phase ${p}`,
      sub: PHASE_TITLES[p] ?? "",
      words: byPhase.get(p)!,
    }))
  if (noPhase.length) {
    groups.push({ key: "no-phase", label: "Ohne Lektion", sub: "noch nicht zugeordnet", words: noPhase })
  }
  return groups
}

export default function VocabPage() {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [grouping, setGrouping] = useState<Grouping>("topic")
  const [view, setView] = useState<View>("karten")

  useEffect(() => {
    fetch("/api/vocab")
      .then((r) => (r.ok ? r.json() : { cards: [] }))
      .then((d) => setCards(d.cards ?? []))
      .finally(() => setLoading(false))
  }, [])

  const summary = useMemo(() => {
    const list = cards ?? []
    return {
      total: list.length,
      solid: list.filter((c) => c.box >= 4 && !c.isDue).length,
      due: list.filter((c) => c.isDue).length,
    }
  }, [cards])

  const groups = useMemo(() => groupCards(cards ?? [], grouping), [cards, grouping])

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

  return (
    <div className="relative min-h-[100dvh] bg-bg flex flex-col w-full max-w-md desk:max-w-[640px] mx-auto px-0 pt-safe md:border-x md:border-border desk:border-x-0 pb-[88px] desk:pb-10">
      {/* Header */}
      <div className="px-[26px] pt-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Vokabeln</h1>
          <p className="text-[14px] font-medium text-muted mt-1">
            {summary.total} {summary.total === 1 ? "Wort" : "Wörter"} ·{" "}
            <span className="text-correct">{summary.solid} sitzen</span> ·{" "}
            <span className="text-accent-bright">{summary.due} fällig</span>
          </p>
        </div>
        <Segmented
          options={[
            { value: "karten", label: "Karten" },
            { value: "kompakt", label: "Kompakt" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {/* Grouping toggle */}
      <div className="px-[26px] mt-4">
        <Segmented
          options={[
            { value: "topic", label: "Nach Thema" },
            { value: "lesson", label: "Nach Lektion" },
          ]}
          value={grouping}
          onChange={setGrouping}
        />
      </div>

      {summary.total === 0 ? (
        <p className="px-[26px] mt-10 text-[15px] text-muted">
          Noch keine Wörter. Starte eine Übung, dann sammeln sie sich hier.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-7">
          {groups.map((g) => (
            <section key={g.key} className="px-[22px]">
              <div className="flex items-baseline justify-between px-1 mb-2.5">
                <h2
                  className="text-[12px] font-extrabold uppercase text-faint"
                  style={{ letterSpacing: "0.12em", fontFamily: "'Hanken Grotesk', sans-serif" }}
                >
                  {g.label}
                </h2>
                <span className="text-[12px] font-semibold text-faint">{g.sub}</span>
              </div>

              <div className={view === "karten" ? "flex flex-col gap-2.5" : "flex flex-col"}>
                {g.words.map((w) =>
                  view === "karten" ? (
                    <article key={w.tr} className="bg-surface border border-border rounded-card px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[18px] font-extrabold tracking-tight">{w.tr}</div>
                          <div className="text-[14px] font-medium text-muted">{w.de}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: strength(w).color }}>
                            {strength(w).label}
                          </span>
                          <StrengthMeter box={w.box} color={strength(w).color} />
                        </div>
                      </div>

                      {w.example && (
                        <div className="mt-3 pl-3 border-l-2 border-border">
                          <div className="text-[14px] font-semibold text-text-body">{w.example.tr}</div>
                          <div className="text-[13px] text-muted">{w.example.de}</div>
                        </div>
                      )}

                      {(w.pos || w.synonyms?.length || w.antonyms?.length) && (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {w.pos && (
                            <span className="text-[12px] font-semibold text-faint px-2 py-[3px] rounded-pill border border-border">
                              {w.pos}
                            </span>
                          )}
                          {w.synonyms?.map((s) => <RelChip key={`s-${s}`} kind="syn" txt={s} />)}
                          {w.antonyms?.map((a) => <RelChip key={`a-${a}`} kind="ant" txt={a} />)}
                        </div>
                      )}
                    </article>
                  ) : (
                    <div key={w.tr} className="flex items-center gap-3 py-2.5 border-b border-divider last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <span className="text-[15.5px] font-bold">{w.tr}</span>
                        <span className="text-[13.5px] text-muted ml-2">{w.de}</span>
                      </div>
                      {w.pos && <span className="text-[11px] text-faint shrink-0">{w.pos}</span>}
                      <StrengthMeter box={w.box} color={strength(w).color} />
                    </div>
                  )
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <TabBar />
    </div>
  )
}
