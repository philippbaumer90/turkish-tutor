import { auth } from "@/auth"
import { seedIfEmpty, getVocab, getProgress, getSessions, calcStreak } from "@/lib/kv"
import { isDue } from "@/lib/srs"
import { getChatPhaseLabel } from "@/lib/prompt"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const sub = session.user.email

  await seedIfEmpty(sub)

  const today = new Date().toISOString().split("T")[0]
  const [vocab, progress, sessions] = await Promise.all([
    getVocab(sub),
    getProgress(sub),
    getSessions(sub),
  ])

  const dueCount = vocab.filter((c) => isDue(c, today)).length
  const streak = calcStreak(sessions, today)
  const lastSession = sessions[0]?.date ?? null
  const phaseLabel = getChatPhaseLabel(progress.phase)

  return Response.json({ dueCount, streak, lastSession, phaseLabel, phase: progress.phase })
}
