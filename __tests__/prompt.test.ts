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

test("new mode appends the new-material block", () => {
  const blocks = buildSystemMessages(progress(), "2026-06-25", { mode: "new" })
  expect(blocks).toHaveLength(3)
  expect(blocks[2].text).toContain("Neue Wörter & Grammatik")
})

test("free mode appends the free block anchored on the last session", () => {
  const blocks = buildSystemMessages(progress(), "2026-06-25", {
    mode: "free",
    lastSession: lastSession(),
  })
  expect(blocks).toHaveLength(3)
  expect(blocks[2].text).toContain("Freies Lernen")
  expect(blocks[2].text).toContain("ben, yorgun") // covered words
})

test("free mode degrades to grammar_covered when there is no last session", () => {
  const blocks = buildSystemMessages(progress(), "2026-06-25", {
    mode: "free",
    lastSession: null,
  })
  expect(blocks[2].text).toContain("sein-Endungen")
  expect(blocks[2].text).toContain("kombiniere die wenigen bekannten Wörter")
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
