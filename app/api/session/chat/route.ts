import { auth } from "@/auth"
import { getProgress } from "@/lib/kv"
import { streamChat } from "@/lib/claude"
import { ratelimit } from "@/lib/ratelimit"
import { z } from "zod"

const BodySchema = z.object({
  messages: z.array(
    z.object({ role: z.enum(["user", "assistant"]), content: z.string() })
  ),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const sub = session.user.email

  const { success } = await ratelimit.limit(sub)
  if (!success) return Response.json({ error: "Zu viele Anfragen." }, { status: 429 })

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 })
  }

  const today = new Date().toISOString().split("T")[0]
  const progress = await getProgress(sub)

  let stream: ReadableStream<Uint8Array>
  try {
    stream = await streamChat(body.messages, progress, today)
  } catch (err) {
    console.error("Claude stream error:", err)
    return Response.json({ error: "Tutor antwortet gerade nicht." }, { status: 502 })
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  })
}
