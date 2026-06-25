import { auth } from "@/auth"
import { getVocab, getProgress, getSessions, saveVocab, saveProgress, saveSessions } from "@/lib/kv"
import { INTERVALS, normalize } from "@/lib/srs"
import { coerceTopic } from "@/lib/topics"
import { extractSessionData } from "@/lib/claude"
import { z } from "zod"

// Background path: the Claude extraction (new vocab, curriculum pointer, weak
// spots, session log). The client fires this AFTER /end has already rendered the
// summary, so its latency is never on the critical path. If it fails, the only
// cost is that this session's new chat words don't reach the deck.
const BodySchema = z.object({
  transcript: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const sub = session.user.email

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 })
  }

  if (body.transcript.length === 0) {
    return Response.json({ newWords: [] })
  }

  const today = new Date().toISOString().split("T")[0]
  const [vocab, progress, sessions] = await Promise.all([
    getVocab(sub),
    getProgress(sub),
    getSessions(sub),
  ])

  let extracted
  try {
    extracted = await extractSessionData(body.transcript, progress, today)
  } catch (err) {
    console.error("extractSessionData error:", err)
    return Response.json({ newWords: [] })
  }

  // Append new vocab from chat (box 1), skipping words already in the deck
  const existingTr = new Set(vocab.map((c) => normalize(c.tr)))
  const newVocabCards = extracted.new_vocab
    .filter((v) => {
      const key = normalize(v.tr)
      if (!key || existingTr.has(key)) return false
      existingTr.add(key)
      return true
    })
    .map((v) => ({
      tr: v.tr,
      de: v.de,
      added: today,
      last_reviewed: today,
      interval_days: INTERVALS[0],
      box: 1,
      notes: v.notes ?? "",
      accept: [],
      // Reference metadata for the Vocabulary tab (all best-effort from extraction).
      topic: coerceTopic(v.topic),
      phase: progress.phase, // the word's "lesson" = the phase active when introduced
      pos: v.pos,
      example: v.example,
      synonyms: v.synonyms,
      antonyms: v.antonyms,
    }))
  const finalVocab = [...vocab, ...newVocabCards]

  const updatedProgress = {
    ...progress,
    ...extracted.pointer_update,
    vocab_count: finalVocab.length,
    grammar_covered: extracted.grammar_covered,
    weak_spots: extracted.weak_spots,
    history: [
      ...progress.history,
      { date: today, note: extracted.session_log.covered.join("; ") || "Sitzung abgeschlossen." },
    ],
  }

  // Enrich today's (placeholder) session log entry written by /end
  const enrichedSessions = sessions.map((s) =>
    s.date === today
      ? {
          date: today,
          covered: extracted.session_log.covered,
          missed: extracted.session_log.missed,
          queued_next: extracted.session_log.queued_next,
          notes: extracted.session_log.notes,
        }
      : s
  )

  await Promise.all([
    saveVocab(sub, finalVocab),
    saveProgress(sub, updatedProgress),
    saveSessions(sub, enrichedSessions),
  ])

  return Response.json({ newWords: extracted.new_vocab })
}
