import { auth } from "@/auth"
import { getVocab, getSessions, saveVocab, saveSessions, calcStreak } from "@/lib/kv"
import { leitnerUpdate, INTERVALS } from "@/lib/srs"
import { z } from "zod"

// Fast path: SRS box updates + streak only. No Claude here — the LLM extraction
// (new vocab, curriculum pointer, weak spots) runs separately in /extract so the
// summary screen renders instantly instead of waiting on a completion.
const BodySchema = z.object({
  results: z.array(z.object({
    vocabIndex: z.number(),
    correct: z.boolean(),
    your: z.string(),
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
  const [vocab, sessions] = await Promise.all([getVocab(sub), getSessions(sub)])

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

  // Session log gets a placeholder entry now (for the streak); /extract enriches
  // it with covered/missed once Claude has run.
  const newSession = { date: today, covered: [], missed: [], queued_next: "" }
  const updatedSessions = [newSession, ...sessions.filter((s) => s.date !== today)].slice(0, 30)

  await Promise.all([
    saveVocab(sub, updatedVocab),
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
    newWords: [], // filled in by /extract after the summary is already showing
    nextDueText: minInterval <= 1 ? "morgen" : `in ${minInterval} Tagen`,
    streak: calcStreak(updatedSessions, today),
  })
}
