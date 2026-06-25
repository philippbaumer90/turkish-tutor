import { Ratelimit } from "@upstash/ratelimit"
import { redis } from "./kv"

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 h"),
  analytics: false,
  prefix: "rl:session",
})
