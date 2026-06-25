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
  const days = new Set(sessions.map((s) => s.date))

  // Count consecutive days ending today. If today has no session yet, start
  // from yesterday so an unfinished today doesn't read as a broken streak.
  const cur = new Date(today + "T00:00:00")
  if (!days.has(today)) cur.setDate(cur.getDate() - 1)

  let streak = 0
  while (days.has(cur.toISOString().split("T")[0])) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}
