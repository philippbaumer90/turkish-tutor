import { coerceSessionExtract, mergeGrammarCovered } from "@/lib/session-extract"
import type { Progress } from "@/lib/kv"
import curriculum from "@/data/curriculum.json"

const phases = (curriculum as { phase: number }[]).map((p) => p.phase)
const minPhase = Math.min(...phases)
const maxPhase = Math.max(...phases)

const progress = (o?: Partial<Progress>): Progress => ({
  phase: 2,
  phase_pointer: "Phase 2 (weiter)",
  next_up: "Fragepartikel",
  grammar_covered: ["A", "B"],
  weak_spots: ["w1"],
  vocab_count: 5,
  history: [],
  ...o,
})

const valid = {
  new_vocab: [{ tr: "ev", de: "Haus" }],
  pointer_update: { phase: maxPhase, phase_pointer: "Phase X", next_up: "Y" },
  weak_spots: ["w2"],
  grammar_covered: ["B", "C"],
  session_log: { covered: ["ev"], missed: [], queued_next: "Z" },
}

describe("coerceSessionExtract", () => {
  it("passes valid tool output through", () => {
    const r = coerceSessionExtract(valid, progress())
    expect(r.new_vocab).toHaveLength(1)
    expect(r.pointer_update.next_up).toBe("Y")
    expect(r.session_log.queued_next).toBe("Z")
  })

  it("tolerates a partial example object (the tool schema permits it)", () => {
    // The save_session tool schema declares example.tr/de WITHOUT a required
    // array, so the model may return example: { tr } or {}. That must not fail
    // the whole payload and discard the session's vocab + pointer.
    const r = coerceSessionExtract(
      { ...valid, new_vocab: [{ tr: "ev", de: "Haus", example: { tr: "evde" } }] },
      progress()
    )
    expect(r.new_vocab).toHaveLength(1)
    expect(r.new_vocab[0].example?.tr).toBe("evde")
  })

  it("returns a safe default built from progress on malformed input", () => {
    const r = coerceSessionExtract({ garbage: true }, progress())
    expect(r.new_vocab).toEqual([])
    expect(r.pointer_update.phase).toBe(2) // from progress, untouched
    expect(r.weak_spots).toEqual(["w1"])
    expect(r.grammar_covered).toEqual(["A", "B"])
    expect(r.session_log.queued_next).toBe("")
  })

  it("returns a safe default on undefined (no tool use)", () => {
    const r = coerceSessionExtract(undefined, progress())
    expect(r.new_vocab).toEqual([])
    expect(r.pointer_update.next_up).toBe("Fragepartikel")
  })

  it("rejects a partial object missing required fields → safe default", () => {
    const r = coerceSessionExtract({ new_vocab: [{ tr: "ev", de: "Haus" }] }, progress())
    expect(r.weak_spots).toEqual(["w1"]) // fell back, didn't half-apply
  })

  it("clamps an out-of-range phase up to the curriculum max", () => {
    const r = coerceSessionExtract(
      { ...valid, pointer_update: { phase: 9999, phase_pointer: "x", next_up: "y" } },
      progress()
    )
    expect(r.pointer_update.phase).toBe(maxPhase)
  })

  it("clamps a negative phase up to the curriculum min", () => {
    const r = coerceSessionExtract(
      { ...valid, pointer_update: { phase: -5, phase_pointer: "x", next_up: "y" } },
      progress()
    )
    expect(r.pointer_update.phase).toBe(minPhase)
  })
})

describe("mergeGrammarCovered", () => {
  it("unions prior + new without duplicates", () => {
    expect(mergeGrammarCovered(["A", "B"], ["B", "C"])).toEqual(["A", "B", "C"])
  })

  it("never drops prior entries when the new list is empty (monotonic)", () => {
    expect(mergeGrammarCovered(["A", "B"], [])).toEqual(["A", "B"])
  })
})
