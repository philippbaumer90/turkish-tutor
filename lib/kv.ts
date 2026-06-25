import { Redis } from "@upstash/redis"
import type { VocabCard } from "./srs"
import seedData from "@/data/seed.json"

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export type Progress = {
  phase: number
  phase_pointer: string
  next_up: string
  grammar_covered: string[]
  weak_spots: string[]
  vocab_count: number
  history: { date: string; note: string }[]
}

export type SessionLog = {
  date: string
  covered: string[]
  missed: string[]
  queued_next: string
  notes?: string
}

export function vocabKey(sub: string) { return `vocab:${sub}` }
export function progressKey(sub: string) { return `progress:${sub}` }
export function sessionsKey(sub: string) { return `sessions:${sub}` }

export async function seedIfEmpty(sub: string): Promise<void> {
  const exists = await redis.exists(vocabKey(sub))
  if (exists) return

  await Promise.all([
    redis.set(vocabKey(sub), seedData.vocab as VocabCard[]),
    redis.set(progressKey(sub), seedData.progress as Progress),
    redis.set(sessionsKey(sub), seedData.sessions as SessionLog[]),
  ])
}

export async function getVocab(sub: string): Promise<VocabCard[]> {
  return ((await redis.get<VocabCard[]>(vocabKey(sub))) ?? [])
}

export async function getProgress(sub: string): Promise<Progress> {
  return (await redis.get<Progress>(progressKey(sub))) ?? (seedData.progress as Progress)
}

export async function getSessions(sub: string): Promise<SessionLog[]> {
  return (await redis.get<SessionLog[]>(sessionsKey(sub))) ?? []
}

export async function saveVocab(sub: string, vocab: VocabCard[]): Promise<void> {
  await redis.set(vocabKey(sub), vocab)
}

export async function saveProgress(sub: string, progress: Progress): Promise<void> {
  await redis.set(progressKey(sub), progress)
}

export async function saveSessions(sub: string, sessions: SessionLog[]): Promise<void> {
  await redis.set(sessionsKey(sub), sessions)
}

export function calcStreak(sessions: SessionLog[], today: string): number {
  if (sessions.length === 0) return 0
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  let streak = 0
  let expected = new Date(today)
  expected.setDate(expected.getDate() - 1) // start checking from yesterday

  for (const s of sorted) {
    const d = new Date(s.date)
    const exp = expected.toISOString().split("T")[0]
    if (s.date === exp) {
      streak++
      expected.setDate(expected.getDate() - 1)
    } else if (s.date < exp) {
      break
    }
  }
  return streak
}
