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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Per-user state derived from phase + weak_spots. Pure.
 *  - needsReview: any keyword matches a weak_spot at a WORD START (case-insensitive)
 *  - else learned: concept.phase <= progress.phase
 *  - else upcoming
 * Word-start (\b prefix) matching keeps intended hits ("akkusativ" → "Akkusativ-
 * Endungen") while avoiding interior-substring false positives ("mein" in
 * "allgemeine", "ort" in "Wort"). `progress` is a structural subset of kv Progress.
 */
export function classify(
  concept: GrammarConcept,
  progress: { phase: number; weak_spots: string[] }
): Classification {
  const isWeak = concept.keywords.some((k) => {
    const re = new RegExp(`\\b${escapeRegExp(k.toLowerCase())}`, "i")
    return progress.weak_spots.some((w) => re.test(w))
  })
  if (isWeak) return "needsReview"
  return concept.phase <= progress.phase ? "learned" : "upcoming"
}
