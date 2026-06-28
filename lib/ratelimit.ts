import { Ratelimit } from "@upstash/ratelimit"
import { redis } from "./kv"

// Per-turn / per-open traffic: /chat and /start share this bucket.
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 h"),
  analytics: false,
  prefix: "rl:session",
})

// /extract fires once per session and persists the learning — it must NOT share
// the chat bucket, or a long session's /chat turns could exhaust it and 429 the
// very call that saves progress. Its own (looser, low-frequency) bucket still
// caps Anthropic cost without starving the high-value call.
export const extractRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 h"),
  analytics: false,
  prefix: "rl:extract",
})
