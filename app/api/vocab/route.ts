import { auth } from "@/auth"
import { seedIfEmpty, getVocab } from "@/lib/kv"
import { isDue } from "@/lib/srs"

// Read-only deck for the Vocabulary tab. Mirrors /api/state: auth → seedIfEmpty →
// read → respond. Each card is augmented with `isDue` (computed server-side) so
// the client never re-derives review dates for the strength badge.
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const sub = session.user.email
  await seedIfEmpty(sub)

  const today = new Date().toISOString().split("T")[0]
  const vocab = await getVocab(sub)
  const cards = vocab.map((c) => ({ ...c, isDue: isDue(c, today) }))

  return Response.json({ cards })
}
