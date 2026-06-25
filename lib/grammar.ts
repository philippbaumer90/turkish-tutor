// Grammar registry type + the pure per-user classifier (plan §5).
// No "server-only" — safe in client bundles, route handlers, and Node scripts.
import grammarData from "@/data/grammar.json"

export type GrammarConcept = {
  id: string // "vokalharmonie", "akkusativ", …
  name: string // display name (German)
  phase: number // phase that introduces it (0–6)
  form: string
  meaning: string
  use: string
  examples: { tr: string; de: string }[] // 2–3 contrastive, using known vocab
  pitfall?: string // common mistake / weak-spot hook
  keywords: string[] // fuzzy-match against weak_spots / grammar_covered
}

export type Classification = "learned" | "upcoming" | "needsReview"

export const GRAMMAR = grammarData as GrammarConcept[]

/**
 * Per-user state derived from phase + weak_spots. Pure.
 *  - needsReview: any keyword (case-insensitive substring) appears in weak_spots
 *  - else learned: concept.phase <= progress.phase
 *  - else upcoming
 * `progress` is intentionally a structural subset of lib/kv Progress.
 */
export function classify(
  concept: GrammarConcept,
  progress: { phase: number; weak_spots: string[] }
): Classification {
  const weak = progress.weak_spots.map((w) => w.toLowerCase())
  const isWeak = concept.keywords.some((k) =>
    weak.some((w) => w.includes(k.toLowerCase()))
  )
  if (isWeak) return "needsReview"
  return concept.phase <= progress.phase ? "learned" : "upcoming"
}
