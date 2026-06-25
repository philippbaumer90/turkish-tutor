// Canonical, CLOSED topic set for vocab grouping (plan §1).
// Pure, no imports — safe everywhere (client, route handler, Node backfill script).
// The extraction tool schema (lib/claude.ts) and the backfill script both pick
// from this list; anything else is coerced to "Sonstiges".
//
// Tune the list against the real seed/curriculum vocab during build, but keep it
// a fixed enum — a free-text topic field fragments the default grouping (#1 risk).

export const TOPICS = [
  "Personen & Pronomen",
  "Familie",
  "Begrüßung & Höflichkeit",
  "Essen & Trinken",
  "Zahlen & Zeit",
  "Orte & Wohnen",
  "Verben (Alltag)",
  "Adjektive & Eigenschaften",
  "Körper & Gesundheit",
  "Natur & Wetter",
  "Fragen & Funktionswörter",
  "Sonstiges", // required fallback bucket
] as const

export type Topic = (typeof TOPICS)[number]

export const FALLBACK_TOPIC: Topic = "Sonstiges"

/** Coerce any (possibly LLM-produced) string to a valid Topic. */
export function coerceTopic(value: string | undefined): Topic {
  return (TOPICS as readonly string[]).includes(value ?? "")
    ? (value as Topic)
    : FALLBACK_TOPIC
}
