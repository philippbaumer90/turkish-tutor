import { buildSystemMessages, PHASE_SHORT_LABELS } from "@/lib/prompt"
import curriculum from "@/data/curriculum.json"
import type { Progress, SessionLog } from "@/lib/kv"

const progress = (overrides?: Partial<Progress>): Progress => ({
  phase: 1,
  phase_pointer: "Phase 1 (weiter)",
  next_up: "Fragepartikel mı/mi/mu/mü",
  grammar_covered: ["sein-Endungen (ben -(y)im, sen -sin, o)"],
  weak_spots: ["Vokalharmonie"],
  vocab_count: 9,
  history: [],
  ...overrides,
})

const lastSession = (overrides?: Partial<SessionLog>): SessionLog => ({
  date: "2026-06-24",
  covered: ["ben", "yorgun"],
  missed: ["aç"],
  queued_next: "Fragepartikel",
  ...overrides,
})

const MODE_MARKER = "AKTUELLER MODUS"

test("no mode block when opts is omitted", () => {
  const blocks = buildSystemMessages(progress(), "2026-06-25")
  expect(blocks).toHaveLength(2)
  expect(blocks.some((b) => b.text.includes(MODE_MARKER))).toBe(false)
})

test("new mode appends the new-material block with a vocab budget", () => {
  const blocks = buildSystemMessages(progress(), "2026-06-25", { mode: "new" })
  expect(blocks).toHaveLength(3)
  expect(blocks[2].text).toContain("Neue Wörter & Grammatik")
  // the "~5–8 Einheiten" budget moved out of the always-on prefix into new mode
  expect(blocks[2].text).toContain("5–8")
})

test("the cached prefix no longer mandates introducing new vocab", () => {
  // The binding "Neue Vokabeln immer einführen" + "~5–8 Einheiten" rules used to
  // live in STABLE_SYSTEM and overrode free mode. Moving them into the new-mode
  // block lets free mode actually forbid new vocab.
  const stable = buildSystemMessages(progress(), "2026-06-25")[0].text
  expect(stable).not.toContain("Neue Vokabeln immer")
  expect(stable).not.toContain("5–8")
})

test("free mode lists the deck's known words and hard-forbids new vocab", () => {
  const blocks = buildSystemMessages(progress(), "2026-06-25", {
    mode: "free",
    lastSession: lastSession(),
    knownWords: ["ben", "yorgun", "aç", "ev", "su"],
  })
  expect(blocks).toHaveLength(3)
  const free = blocks[2].text
  expect(free).toContain("Freies Lernen")
  // the actual known-word inventory reaches the model (not just coverage prose)
  expect(free).toContain("ben")
  expect(free).toContain("su")
  // a HARD, ungated constraint — not a "WENN wenig vorliegt" fallback
  expect(free).toContain("AUSSCHLIESSLICH")
  expect(free).toMatch(/KEINE neuen/i)
})

test("free mode degrades to known grammar when the deck is empty", () => {
  const blocks = buildSystemMessages(progress(), "2026-06-25", {
    mode: "free",
    lastSession: null,
    knownWords: [],
  })
  const free = blocks[2].text
  expect(free).toContain("Freies Lernen")
  expect(free).toContain("sein-Endungen") // from grammar_covered fallback
})

test("free mode tolerates a malformed last session (missing covered/missed)", () => {
  // Redis data is not runtime-validated; a legacy/partial session must not crash.
  const blocks = buildSystemMessages(progress(), "2026-06-25", {
    mode: "free",
    lastSession: { date: "2026-06-24", queued_next: "x" } as unknown as SessionLog,
    knownWords: ["ben"],
  })
  expect(blocks[2].text).toContain("Freies Lernen")
})

test("the cached prefix (block 1) is unchanged across modes", () => {
  const base = buildSystemMessages(progress(), "2026-06-25")
  const free = buildSystemMessages(progress(), "2026-06-25", { mode: "free", lastSession: null })
  expect(free[0]).toEqual(base[0])
  expect(free[0].cache_control).toEqual({ type: "ephemeral" })
})

// The sidebar maps PHASE_SHORT_LABELS by phase index, so its length is a second
// source of truth for the phase count. If a phase is added to curriculum.json
// without a matching label, every row would render as "done" (i < phase) with no
// current highlight. This locks the two together.
test("PHASE_SHORT_LABELS stays in lockstep with the curriculum", () => {
  expect(PHASE_SHORT_LABELS).toHaveLength(curriculum.length)
})
