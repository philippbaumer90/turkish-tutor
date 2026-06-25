import { auth } from "@/auth"
import { getVocab, getProgress, getSessions, saveVocab, saveProgress, saveSessions, calcStreak } from "@/lib/kv"
import { leitnerUpdate, INTERVALS, normalize } from "@/lib/srs"
import { extractSessionData, type SessionExtract } from "@/lib/claude"
import { z } from "zod"

const BodySchema = z.object({
  results: z.array(z.object({
    vocabIndex: z.number(),
    correct: z.boolean(),
    your: z.string(),
  })),
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

  const today = new Date().toISOString().split("T")[0]
  const [vocab, progress, sessions] = await Promise.all([
    getVocab(sub),
    getProgress(sub),
    getSessions(sub),
  ])

  // SRS updates — server-side, recomputed from recorded answers
  const updatedVocab = [...vocab]
  const boxMoves: { tr: string; de: string; from: number; to: number }[] = []

  for (const r of body.results) {
    const card = vocab[r.vocabIndex]
    if (!card) continue
    const from = card.box
    const updated = leitnerUpdate(card, r.correct, today)
    updatedVocab[r.vocabIndex] = updated
    boxMoves.push({ tr: card.tr, de: card.de, from, to: updated.box })
  }

  // Extract session data via Claude (new vocab, curriculum pointer, log)
  let extracted: SessionExtract = {
    new_vocab: [],
    pointer_update: {
      phase: progress.phase,
      phase_pointer: progress.phase_pointer,
      next_up: progress.next_up,
    },
    weak_spots: progress.weak_spots,
    grammar_covered: progress.grammar_covered,
    session_log: {
      covered: [],
      missed: [],
      queued_next: "",
    },
  }

  if (body.transcript.length > 0) {
    try {
      extracted = await extractSessionData(body.transcript, progress, today)
    } catch (err) {
      console.error("extractSessionData error:", err)
    }
  }

  // Append new vocab from chat (box 1), skipping words already in the deck
  const existingTr = new Set(updatedVocab.map((c) => normalize(c.tr)))
  const newVocabCards = extracted.new_vocab
    .filter((v) => {
      const key = normalize(v.tr)
      if (!key || existingTr.has(key)) return false
      existingTr.add(key) // also guards against dupes within this batch
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
    }))
  const finalVocab = [...updatedVocab, ...newVocabCards]

  // Update progress — weak_spots and grammar_covered now adapt via Claude
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

  // Append session log (newest first, cap 30)
  const newSession = {
    date: today,
    covered: extracted.session_log.covered,
    missed: extracted.session_log.missed,
    queued_next: extracted.session_log.queued_next,
    notes: extracted.session_log.notes,
  }
  // Newest first, cap 30, and collapse a second session on the same day
  const updatedSessions = [newSession, ...sessions.filter((s) => s.date !== today)].slice(0, 30)

  await Promise.all([
    saveVocab(sub, finalVocab),
    saveProgress(sub, updatedProgress),
    saveSessions(sub, updatedSessions),
  ])

  const reviewed = body.results.length
  const correct = body.results.filter((r) => r.correct).length
  const intervals = boxMoves.map((m) => INTERVALS[m.to - 1])
  const minInterval = intervals.length ? Math.min(...intervals) : 1

  return Response.json({
    reviewed,
    correct,
    boxMoves,
    newWords: extracted.new_vocab,
    nextDueText: minInterval <= 1 ? "morgen" : `in ${minInterval} Tagen`,
    streak: calcStreak(updatedSessions, today),
  })
}
