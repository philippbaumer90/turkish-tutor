import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { buildSystemMessages } from "./prompt"
import type { Mode } from "./prompt"
import type { Progress, SessionLog } from "./kv"

const client = new Anthropic()

export type ChatMessage = { role: "user" | "assistant"; content: string }

export async function streamChat(
  messages: ChatMessage[],
  progress: Progress,
  today: string,
  opts?: { mode?: Mode; lastSession?: SessionLog | null }
): Promise<ReadableStream<Uint8Array>> {
  const system = buildSystemMessages(progress, today, opts)

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system,
    messages,
  })

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })
}

export type SessionExtract = {
  new_vocab: { tr: string; de: string; notes?: string }[]
  pointer_update: { phase: number; phase_pointer: string; next_up: string }
  weak_spots: string[]
  grammar_covered: string[]
  session_log: {
    covered: string[]
    missed: string[]
    queued_next: string
    notes?: string
  }
}

export async function extractSessionData(
  transcript: ChatMessage[],
  progress: Progress,
  today: string
): Promise<SessionExtract> {
  const system = buildSystemMessages(progress, today)

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    tools: [
      {
        name: "save_session",
        description: "Extrahiere strukturierte Sitzungsdaten aus dem Gesprächsverlauf.",
        input_schema: {
          type: "object" as const,
          properties: {
            new_vocab: {
              type: "array",
              description: "Neue Vokabeln, die während der Chat-Phase eingeführt oder geübt wurden.",
              items: {
                type: "object",
                properties: {
                  tr: { type: "string", description: "Türkisches Wort" },
                  de: { type: "string", description: "Deutsche Bedeutung" },
                  notes: { type: "string", description: "Kurze Grammatiknotiz" },
                },
                required: ["tr", "de"],
              },
            },
            pointer_update: {
              type: "object",
              description: "Aktualisierter Lehrplanzeiger basierend auf dem Fortschritt.",
              properties: {
                phase: { type: "number", description: "Aktuelle Phasennummer (0–6)" },
                phase_pointer: { type: "string", description: "Kurze Phase-ID, z.B. 'Phase 1 (weiter)'" },
                next_up: { type: "string", description: "Nächster Schritt (Prosa für Claude-Kontext)" },
              },
              required: ["phase", "phase_pointer", "next_up"],
            },
            weak_spots: {
              type: "array",
              items: { type: "string" },
              description: "VOLLSTÄNDIGE aktualisierte Liste der Schwachpunkte des Lernenden. Nimm die bisherigen Schwachpunkte aus dem Kontext, entferne, was er in dieser Sitzung sicher beherrscht hat, und füge neue hinzu, bei denen er Fehler gemacht hat.",
            },
            grammar_covered: {
              type: "array",
              items: { type: "string" },
              description: "VOLLSTÄNDIGE aktualisierte Liste der behandelten Grammatikthemen. Bisherige Themen aus dem Kontext plus alles, was in dieser Sitzung neu eingeführt wurde.",
            },
            session_log: {
              type: "object",
              description: "Sitzungsprotokoll.",
              properties: {
                covered: { type: "array", items: { type: "string" }, description: "Was wurde behandelt" },
                missed: { type: "array", items: { type: "string" }, description: "Was wurde verfehlt" },
                queued_next: { type: "string", description: "Fokus für die nächste Sitzung" },
                notes: { type: "string", description: "Besondere Anmerkungen" },
              },
              required: ["covered", "missed", "queued_next"],
            },
          },
          required: ["new_vocab", "pointer_update", "weak_spots", "grammar_covered", "session_log"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "save_session" },
    messages: [
      ...transcript,
      {
        role: "user",
        content: `Extrahiere jetzt die strukturierten Sitzungsdaten aus dem obigen Gespräch. Heutiges Datum: ${today}. Aktuelle Phase: ${progress.phase}.`,
      },
    ],
  })

  const toolUse = response.content.find((b) => b.type === "tool_use")
  if (!toolUse || toolUse.type !== "tool_use") {
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

  return toolUse.input as SessionExtract
}

