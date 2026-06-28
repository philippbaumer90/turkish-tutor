import { z } from "zod"
import type { Progress } from "./kv"
import curriculum from "@/data/curriculum.json"

// Shape of the `save_session` tool output. The LLM is *asked* to honor the
// JSON schema in lib/claude.ts, but tool output is untrusted input — it gets
// persisted to Redis and read back into the next system prompt, so it must be
// validated at this boundary, not cast with `as`.
export const SessionExtractSchema = z.object({
  new_vocab: z.array(
    z.object({
      tr: z.string(),
      de: z.string(),
      notes: z.string().optional(),
      topic: z.string().optional(),
      pos: z.string().optional(),
      // Sub-fields optional to match the tool schema (which marks neither
      // required) — a partial example must not fail the whole payload.
      example: z.object({ tr: z.string().optional(), de: z.string().optional() }).optional(),
      synonyms: z.array(z.string()).optional(),
      antonyms: z.array(z.string()).optional(),
    })
  ),
  pointer_update: z.object({
    phase: z.number(),
    phase_pointer: z.string(),
    next_up: z.string(),
  }),
  weak_spots: z.array(z.string()),
  grammar_covered: z.array(z.string()),
  session_log: z.object({
    covered: z.array(z.string()),
    missed: z.array(z.string()),
    queued_next: z.string(),
    notes: z.string().optional(),
  }),
})

export type SessionExtract = z.infer<typeof SessionExtractSchema>

const PHASES = (curriculum as { phase: number }[]).map((p) => p.phase)
const MIN_PHASE = Math.min(...PHASES)
const MAX_PHASE = Math.max(...PHASES)

// The no-op extraction: keep the learner's current state, add nothing. Used when
// the model returns no tool call or malformed output.
function safeDefault(progress: Progress): SessionExtract {
  return {
    new_vocab: [],
    pointer_update: {
      phase: progress.phase,
      phase_pointer: progress.phase_pointer,
      next_up: progress.next_up,
    },
    weak_spots: progress.weak_spots,
    grammar_covered: progress.grammar_covered,
    session_log: { covered: [], missed: [], queued_next: "" },
  }
}

// Validate untrusted tool output before it reaches storage. On any failure,
// degrade to the no-op default rather than persisting garbage. Clamp phase to
// the real curriculum range so a hallucinated number can't corrupt progression.
export function coerceSessionExtract(input: unknown, progress: Progress): SessionExtract {
  const parsed = SessionExtractSchema.safeParse(input)
  if (!parsed.success) return safeDefault(progress)

  const data = parsed.data
  data.pointer_update.phase = Math.min(
    Math.max(data.pointer_update.phase, MIN_PHASE),
    MAX_PHASE
  )
  return data
}

// grammar_covered is monotonic — it should only ever grow. The LLM is asked for
// the full list each time, but a forgetful turn must not be able to shrink it,
// so union with the prior server-side value.
export function mergeGrammarCovered(prev: string[], next: string[]): string[] {
  return Array.from(new Set([...prev, ...next]))
}
