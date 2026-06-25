import { auth } from "@/auth"
import { seedIfEmpty, getVocab, getProgress } from "@/lib/kv"
import { buildQueue, assignDirections } from "@/lib/srs"
import { ratelimit } from "@/lib/ratelimit"

export async function POST() {
  const session = await auth()
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const sub = session.user.email

  const { success } = await ratelimit.limit(sub)
  if (!success) return Response.json({ error: "Zu viele Anfragen. Bitte kurz warten." }, { status: 429 })

  await seedIfEmpty(sub)

  const today = new Date().toISOString().split("T")[0]
  const [vocab, progress] = await Promise.all([getVocab(sub), getProgress(sub)])

  const queue = buildQueue(vocab, today, 10)
  const vocabWithDir = assignDirections(vocab, queue)

  return Response.json({ vocab: vocabWithDir, queue, progress, today })
}
