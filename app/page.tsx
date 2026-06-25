"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type StateData = {
  dueCount: number
  streak: number
  lastSession: string | null
  phaseLabel: string
}

export default function HomePage() {
  const router = useRouter()
  const [state, setState] = useState<StateData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then(setState)
      .finally(() => setLoading(false))
  }, [])

  const hasDue = (state?.dueCount ?? 0) > 0

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-muted animate-dotpulse"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-[100dvh] bg-bg flex flex-col w-full max-w-md mx-auto px-0 pt-safe">
      {/* Greeting */}
      <div className="px-[26px] pt-6">
        <h1 className="text-[28px] font-extrabold tracking-tight">Merhaba!</h1>
        <p className="text-[16px] font-medium text-muted mt-1">Schön, dass du da bist.</p>
      </div>

      {/* Hero card */}
      {hasDue ? (
        <div className="mx-[22px] mt-8 bg-surface border border-border rounded-card p-8 text-center">
          <div className="text-[104px] leading-none font-extrabold tracking-tighter text-accent-bright">
            {state?.dueCount}
          </div>
          <div className="text-[19px] font-bold mt-2.5">Wörter fällig heute</div>
          <div className="text-[14.5px] font-medium text-muted mt-1.5">
            Ein kurzer Durchgang reicht.
          </div>
        </div>
      ) : (
        <div className="mx-[22px] mt-8 bg-surface border border-border rounded-card p-9 text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-[30px] text-correct"
            style={{ background: "rgba(155,178,101,.12)", border: "1.5px solid rgba(155,178,101,.4)" }}>
            ✓
          </div>
          <div className="text-[21px] font-extrabold">Alles wiederholt!</div>
          <div className="text-[14.5px] font-medium text-muted mt-2 leading-relaxed">
            Nichts mehr fällig heute.<br />Nächste Wiederholung morgen.
          </div>
        </div>
      )}

      {/* Streak row */}
      <div className="flex items-center gap-3 px-6 mt-[22px]">
        <span className="text-[14px] font-extrabold text-on-accent bg-accent px-[15px] py-[9px] rounded-pill">
          {state?.streak ?? 0}-Tage-Streak
        </span>
        <span className="text-[14.5px] font-semibold text-muted">
          {state?.lastSession ? "zuletzt gestern" : "neu gestartet"}
        </span>
      </div>

      {/* CTA */}
      <div className="absolute bottom-0 left-0 right-0 w-full max-w-md mx-auto px-[22px] pb-9">
        {hasDue ? (
          <button
            onClick={() => router.push("/session")}
            className="w-full h-[60px] rounded-pill bg-accent text-on-accent flex items-center justify-center gap-2.5 text-[18px] font-extrabold"
          >
            Los geht&apos;s <span className="text-[20px]">→</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => router.push("/session?mode=new")}
              className="w-full h-[60px] rounded-pill bg-accent text-on-accent flex items-center justify-center gap-2.5 text-[18px] font-extrabold"
            >
              Neue Wörter lernen <span className="text-[20px]">→</span>
            </button>
            <button
              onClick={() => router.push("/session?mode=review")}
              className="w-full text-center mt-4 text-[14px] font-semibold text-muted"
            >
              Freies Lernen
            </button>
          </>
        )}
      </div>
    </div>
  )
}
