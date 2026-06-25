// One-time enrichment of existing vocab decks + the seed deck with reference
// metadata (topic / pos / example / synonyms / antonyms) for the Vocabulary tab.
//
// Runner:  npx tsx --env-file=.env.local scripts/backfill-vocab.ts
//   (loads UPSTASH_REDIS_REST_URL / _TOKEN and ANTHROPIC_API_KEY)
//
// SELF-CONTAINED ON PURPOSE — do NOT import the app's lib/ runtime layer:
//   - lib/claude.ts starts with `import "server-only"` (throws outside RSC)
//   - lib/kv.ts imports `@/data/seed.json` via the `@/*` alias tsx won't resolve
// So we instantiate our own Redis + Anthropic clients and import only the pure,
// alias-free helpers (normalize, TOPICS) plus curriculum.json by relative path.
//
// Idempotent: a card that already has `topic` is skipped, so re-running is a no-op.

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Redis } from "@upstash/redis"
import Anthropic from "@anthropic-ai/sdk"
import { normalize, type VocabCard } from "../lib/srs"
import { TOPICS } from "../lib/topics"
import curriculum from "../data/curriculum.json"

const EMAILS = ["philipp.baumer@googlemail.com", "ekinkano@gmail.com"]
const SEED_PATH = fileURLToPath(new URL("../data/seed.json", import.meta.url))

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})
const anthropic = new Anthropic()

// Map normalize(tr) -> phase, from the curriculum's per-phase vocab lists.
const phaseByWord = new Map<string, number>()
for (const c of curriculum as { phase: number; vocab: { tr: string }[] }[]) {
  for (const v of c.vocab ?? []) phaseByWord.set(normalize(v.tr), c.phase)
}

type Enrichment = {
  tr: string
  topic: string
  pos: string
  example: { tr: string; de: string }
  synonyms?: string[]
  antonyms?: string[]
}

// One batched tool call enriches every under-enriched card. The full deck word
// list is passed as the allowed example vocabulary so example sentences lean on
// words the learner already knows.
async function enrich(
  cards: VocabCard[],
  deckWords: string[]
): Promise<Map<string, Enrichment>> {
  if (cards.length === 0) return new Map()

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    tools: [
      {
        name: "save_enrichment",
        description: "Reichere türkische Vokabeln mit Referenz-Metadaten an.",
        input_schema: {
          type: "object" as const,
          properties: {
            words: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tr: { type: "string", description: "Das türkische Wort (unverändert)." },
                  topic: {
                    type: "string",
                    enum: TOPICS as unknown as string[],
                    description: "Semantisches Feld — GENAU EINES aus der Liste; sonst 'Sonstiges'.",
                  },
                  pos: { type: "string", description: "Wortart, z.B. 'Substantiv', 'Verb', 'Adjektiv'." },
                  example: {
                    type: "object",
                    description: "Kurzer Beispielsatz, der möglichst nur Wörter aus der bekannten Liste nutzt.",
                    properties: {
                      tr: { type: "string" },
                      de: { type: "string" },
                    },
                    required: ["tr", "de"],
                  },
                  synonyms: { type: "array", items: { type: "string" }, description: "Türkische Synonyme (nur wenn sinnvoll)." },
                  antonyms: { type: "array", items: { type: "string" }, description: "Türkische Gegenwörter (nur wenn sinnvoll)." },
                },
                required: ["tr", "topic", "pos", "example"],
              },
            },
          },
          required: ["words"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "save_enrichment" },
    messages: [
      {
        role: "user",
        content:
          `Reichere diese türkischen Vokabeln für einen deutschsprachigen A1-Lernenden an. ` +
          `Für jedes Wort: das passende semantische Feld (topic) aus der erlaubten Liste, die Wortart (pos), ` +
          `einen sehr einfachen Beispielsatz (example, tr + de) und – nur wo sinnvoll – Synonyme/Gegenwörter.\n\n` +
          `BEKANNTER WORTSCHATZ (Beispielsätze sollen möglichst nur diese Wörter verwenden):\n` +
          deckWords.join(", ") +
          `\n\nWörter zum Anreichern:\n` +
          cards.map((c) => `- ${c.tr} (${c.de})`).join("\n"),
      },
    ],
  })

  const tool = response.content.find((b) => b.type === "tool_use")
  if (!tool || tool.type !== "tool_use") {
    throw new Error("No tool_use block returned from enrichment call")
  }
  const out = (tool.input as { words: Enrichment[] }).words ?? []
  const byTr = new Map<string, Enrichment>()
  for (const e of out) byTr.set(normalize(e.tr), e)
  return byTr
}

// Apply phase (from curriculum) + LLM enrichment to a deck. Cards with a topic
// already set are left untouched (idempotent).
function applyEnrichment(card: VocabCard, e: Enrichment | undefined): VocabCard {
  const phase = card.phase ?? phaseByWord.get(normalize(card.tr))
  if (card.topic) return phase !== undefined ? { ...card, phase } : card
  return {
    ...card,
    phase,
    topic: e?.topic,
    pos: e?.pos,
    example: e?.example,
    synonyms: e?.synonyms,
    antonyms: e?.antonyms,
  }
}

async function backfillDeck(vocab: VocabCard[]): Promise<VocabCard[]> {
  const deckWords = vocab.map((c) => `${c.tr} (${c.de})`)
  const toEnrich = vocab.filter((c) => !c.topic)
  const enrichments = await enrich(toEnrich, deckWords)
  return vocab.map((c) => applyEnrichment(c, enrichments.get(normalize(c.tr))))
}

async function main() {
  // 1. Per-user Redis decks
  for (const email of EMAILS) {
    const key = `vocab:${email}`
    const vocab = (await redis.get<VocabCard[]>(key)) ?? []
    if (vocab.length === 0) {
      console.log(`· ${email}: no deck, skipping`)
      continue
    }
    const missing = vocab.filter((c) => !c.topic).length
    if (missing === 0) {
      console.log(`· ${email}: already enriched (${vocab.length} cards), no-op`)
      continue
    }
    const enriched = await backfillDeck(vocab)
    await redis.set(key, enriched)
    console.log(`✓ ${email}: enriched ${missing}/${vocab.length} cards`)
  }

  // 2. seed.json (so brand-new users start rich)
  const seed = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as { vocab: VocabCard[] }
  const seedMissing = seed.vocab.filter((c) => !c.topic).length
  if (seedMissing === 0) {
    console.log(`· seed.json: already enriched, no-op`)
  } else {
    seed.vocab = await backfillDeck(seed.vocab)
    writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2) + "\n", "utf-8")
    console.log(`✓ seed.json: enriched ${seedMissing}/${seed.vocab.length} cards`)
  }

  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
