import { auth } from "@/auth"
import { seedIfEmpty, getProgress } from "@/lib/kv"
import { GRAMMAR, classify } from "@/lib/grammar"

// Read-only grammar registry for the Grammatik tab. The per-user overlay
// (learned / upcoming / needsReview) is computed server-side via classify(),
// keeping the client dumb — same shape of contract as /api/state.
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const sub = session.user.email
  await seedIfEmpty(sub)

  const progress = await getProgress(sub)
  const concepts = GRAMMAR.map((c) => ({
    ...c,
    classification: classify(c, progress),
  }))

  return Response.json({
    concepts,
    phase: progress.phase,
    weak_spots: progress.weak_spots,
    grammar_covered: progress.grammar_covered,
  })
}
