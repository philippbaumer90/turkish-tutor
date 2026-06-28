export const INTERVALS = [1, 3, 7, 16, 35] // days, boxes 1–5

export type VocabCard = {
  tr: string
  de: string
  added: string
  last_reviewed: string | null
  interval_days: number
  box: number
  notes?: string
  accept?: string[]
  // Optional reference metadata for the Vocabulary tab. All optional so existing
  // Redis data stays valid and SRS logic below is untouched. Populated at capture
  // (api/session/extract) and by the one-time scripts/backfill-vocab.ts.
  topic?: string // one of lib/topics TOPICS
  phase?: number // curriculum phase ("lesson") the word belongs to
  pos?: string // part of speech, e.g. "Substantiv", "Verb"
  example?: { tr: string; de: string } // one in-context sentence, leaning on known words
  synonyms?: string[]
  antonyms?: string[]
}

export type CardWithDir = VocabCard & { dir: "de2tr" | "tr2de" }

export type ReviewResult = {
  tr: string
  de: string
  correct: boolean
  your: string
  from: number
  to: number
  interval: number
}

// Exact implementation from design handoff README — do not modify
export function normalize(s: string): string {
  return (s || "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .replace(/Ş/g, "ş")
    .replace(/Ç/g, "ç")
    .replace(/Ö/g, "ö")
    .replace(/Ü/g, "ü")
    .replace(/Ğ/g, "ğ")
    .toLowerCase()
    .normalize("NFC")
}

// A German gloss can pack several meanings plus an annotation into one string,
// e.g. "dein / du (Besitzpronomen)". Expand it into the individual acceptable
// answers — drop parenthetical annotations, split on "/", ";" or " oder " — so a
// single correct meaning counts as correct without hand-maintaining accept[].
// Comma is deliberately NOT a separator: it appears inside one-phrase glosses
// ("Hallo, guten Tag") far more often than as an alternation.
function expandGlosses(raw: string): string[] {
  const stripped = raw.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim()
  const alts = stripped
    .split(/\s*[/;]\s*|\s+oder\s+/)
    .map((a) => a.trim())
    .filter(Boolean)
  return [raw.trim(), stripped, ...alts].filter(Boolean)
}

export function validAnswers(card: CardWithDir): string[] {
  // de2tr: the Turkish word is the single canonical answer — keep it exact, never
  // split it. Only the German gloss side (tr2de) carries multiple meanings.
  if (card.dir === "de2tr") return [card.tr]
  const expanded = [card.de, ...(card.accept ?? [])].flatMap(expandGlosses)
  return Array.from(new Set(expanded))
}

export function gradeAnswer(answer: string, card: CardWithDir): boolean {
  const norm = normalize(answer)
  return validAnswers(card).some((a) => normalize(a) === norm)
}

export function isDue(card: VocabCard, today: string): boolean {
  if (!card.last_reviewed) return true
  const reviewed = new Date(card.last_reviewed)
  const due = new Date(reviewed)
  due.setDate(due.getDate() + card.interval_days)
  return due <= new Date(today)
}

export function leitnerUpdate(
  card: VocabCard,
  correct: boolean,
  today: string
): VocabCard {
  const newBox = correct ? Math.min(5, card.box + 1) : 1
  return {
    ...card,
    box: newBox,
    interval_days: INTERVALS[newBox - 1],
    last_reviewed: today,
  }
}

export function buildQueue(vocab: VocabCard[], today: string, cap = 10): number[] {
  const due = vocab
    .map((c, i) => ({ i, due: isDue(c, today) }))
    .filter((x) => x.due)
    .map((x) => x.i)

  // shuffle
  for (let i = due.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[due[i], due[j]] = [due[j], due[i]]
  }

  return due.slice(0, cap)
}

export function assignDirections(
  vocab: VocabCard[],
  queue: number[]
): CardWithDir[] {
  return vocab.map((c, i) => ({
    ...c,
    dir: queue.indexOf(i) % 2 === 0 ? "de2tr" : "tr2de",
  }))
}
