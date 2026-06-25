"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import ProgressBar from "@/components/ProgressBar"
import ChatBubble from "@/components/ChatBubble"
import SessionSummary from "@/components/SessionSummary"
import { gradeAnswer, INTERVALS } from "@/lib/srs"
import type { CardWithDir, ReviewResult } from "@/lib/srs"
import { collectTerms } from "@/lib/claude"

type CardPhase = "prompt" | "feedback" | "reveal"
type Screen = "card" | "chat" | "summary"

type CardResult = {
  correct: boolean
  your: string
  target: string
  prompt: string
  sub: string
  note: string
}

type ChatMsg = { role: "tutor" | "me"; text: string }

type SummaryData = {
  reviewed: number
  correct: number
  boxMoves: { tr: string; de: string; from: number; to: number }[]
  newWords: { tr: string; de: string }[]
  nextDueText: string
  newTerms: string[]
}

export default function SessionPage() {
  const router = useRouter()
  const params = useSearchParams()

  const [screen, setScreen] = useState<Screen>("card")
  const [vocab, setVocab] = useState<CardWithDir[]>([])
  const [queue, setQueue] = useState<number[]>([])
  const [qi, setQi] = useState(0)
  const [cardPhase, setCardPhase] = useState<CardPhase>("prompt")
  const [input, setInput] = useState("")
  const [result, setResult] = useState<CardResult | null>(null)
  const [results, setResults] = useState<ReviewResult[]>([])
  const [moves, setMoves] = useState<Record<number, { from: number; to: number }>>({})
  const [phaseLabel, setPhaseLabel] = useState("")
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState("")
  const [pending, setPending] = useState(false)
  const [newTerms, setNewTerms] = useState<string[]>([])
  const [exitOpen, setExitOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [streak, setStreak] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)

  useEffect(() => {
    fetch("/api/session/start", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        setVocab(data.vocab)
        setQueue(data.queue)
        setPhaseLabel(data.progress?.phase_pointer ?? "")
        setLoading(false)

        if (data.queue.length === 0 || params.get("mode") === "new") {
          goChat(data.progress)
        }
      })
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chat, pending])

  function curCard(): CardWithDir | null {
    const idx = queue[qi]
    return idx != null ? vocab[idx] : null
  }

  function promptOf(c: CardWithDir) { return c.dir === "de2tr" ? c.de : c.tr }
  function targetOf(c: CardWithDir) { return c.dir === "de2tr" ? c.tr : c.de }
  function askLang(c: CardWithDir) { return c.dir === "de2tr" ? "auf Türkisch" : "auf Deutsch" }
  function dirLabel(c: CardWithDir) { return c.dir === "de2tr" ? "Übersetze ins Türkische" : "Übersetze ins Deutsche" }

  function submitAnswer() {
    const c = curCard()
    if (!c || !input.trim()) return

    const ok = gradeAnswer(input.trim(), c)
    const idx = queue[qi]
    const from = c.box
    const to = ok ? Math.min(5, from + 1) : 1

    setMoves((prev) => ({ ...prev, [idx]: { from, to } }))
    setResults((prev) => [
      ...prev,
      { tr: c.tr, de: c.de, correct: ok, your: input.trim(), from, to, interval: INTERVALS[to - 1] },
    ])
    setResult({
      correct: ok,
      your: input.trim(),
      target: targetOf(c),
      prompt: promptOf(c),
      sub: askLang(c),
      note: c.notes ?? "",
    })
    setCardPhase("feedback")
  }

  function showAnswer() {
    const c = curCard()
    if (!c) return
    setResult({ correct: false, your: "", target: targetOf(c), prompt: promptOf(c), sub: askLang(c), note: c.notes ?? "" })
    setCardPhase("reveal")
  }

  function selfGrade(known: boolean) {
    const c = curCard()
    if (!c) return
    const idx = queue[qi]
    const from = c.box
    const to = known ? Math.min(5, from + 1) : 1
    setMoves((prev) => ({ ...prev, [idx]: { from, to } }))
    setResults((prev) => [
      ...prev,
      { tr: c.tr, de: c.de, correct: known, your: "gezeigt", from, to, interval: INTERVALS[to - 1] },
    ])
    nextCard()
  }

  function nextCard() {
    if (qi + 1 >= queue.length) {
      goChat()
    } else {
      setQi(qi + 1)
      setCardPhase("prompt")
      setInput("")
      setResult(null)
    }
  }

  function goChat(progress?: unknown) {
    const opener: ChatMsg = {
      role: "tutor",
      text: "Stark gemacht! Jetzt etwas Neues: Lass uns die Fragepartikel **mı/mi/mu/mü** anschauen. Dieser Partikel macht aus einem Aussagesatz eine Ja/Nein-Frage — anders als im Deutschen, wo nur die Wortstellung wechselt. Wie lautet die Frage: „Bist du müde?" auf Türkisch?",
    }
    setChat([opener])
    setNewTerms(collectTerms([], opener.text))
    setScreen("chat")
  }

  async function sendChat() {
    if (!chatInput.trim() || pending) return

    const me: ChatMsg = { role: "me", text: chatInput.trim() }
    const updatedChat = [...chat, me]
    setChat(updatedChat)
    setChatInput("")
    setPending(true)

    const apiMessages = updatedChat.map((m) => ({
      role: m.role === "me" ? "user" as const : "assistant" as const,
      content: m.text,
    }))

    try {
      const res = await fetch("/api/session/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!res.ok || !res.body) throw new Error("No stream")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ""

      const tutorMsg: ChatMsg = { role: "tutor", text: "" }
      setChat((prev) => [...prev, tutorMsg])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setChat((prev) => {
          const next = [...prev]
          next[next.length - 1] = { role: "tutor", text: full }
          return next
        })
      }

      setNewTerms((prev) => collectTerms(prev, full))
    } catch {
      setChat((prev) => [
        ...prev,
        { role: "tutor", text: "Tut mir leid, der Tutor antwortet gerade nicht. Versuche es nochmal." },
      ])
    } finally {
      setPending(false)
    }
  }

  async function endSession() {
    const transcript = chat.map((m) => ({
      role: m.role === "me" ? "user" as const : "assistant" as const,
      content: m.text,
    }))
    const clientResults = results.map((r, i) => ({
      vocabIndex: queue[i] ?? 0,
      correct: r.correct,
      your: r.your,
    }))

    try {
      const res = await fetch("/api/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: clientResults, transcript, newTerms }),
      })
      const data = await res.json()
      setSummaryData({ ...data, streak: streak + 1 })
      setScreen("summary")
    } catch {
      setScreen("summary")
      setSummaryData({
        reviewed: results.length,
        correct: results.filter((r) => r.correct).length,
        boxMoves: [],
        newWords: [],
        nextDueText: "morgen",
        newTerms,
      })
    }
  }

  // Swipe handling
  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.changedTouches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx > 50 && cardPhase === "feedback") nextCard()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-muted animate-dotpulse"
              style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (screen === "summary" && summaryData) {
    return (
      <SessionSummary
        reviewed={summaryData.reviewed}
        correct={summaryData.correct}
        boxMoves={summaryData.boxMoves}
        newWords={summaryData.newWords}
        nextDueText={summaryData.nextDueText}
        streak={streak + 1}
        onFinish={() => router.push("/")}
      />
    )
  }

  // ---- FLASHCARD SCREEN ----
  if (screen === "card") {
    const c = curCard()
    return (
      <div
        className="relative min-h-screen bg-bg max-w-sm mx-auto overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Status bar */}
        <div className="h-[52px] flex items-center justify-between px-7 pt-2">
          <span className="text-[15px] font-bold">9:41</span>
        </div>

        <ProgressBar current={qi + 1} total={queue.length} onExit={() => setExitOpen(true)} />

        {c && (
          <>
            {/* PROMPT */}
            {cardPhase === "prompt" && (
              <>
                <div className="mx-[22px] mt-11 bg-surface border border-border rounded-card px-[26px] py-12 text-center">
                  <div
                    className="text-[13px] font-extrabold uppercase text-muted"
                    style={{ letterSpacing: "0.1em", fontFamily: "'Hanken Grotesk', sans-serif" }}
                  >
                    {dirLabel(c)}
                  </div>
                  <div className="text-[46px] font-extrabold tracking-tight mt-[18px]">
                    {promptOf(c)}
                  </div>
                </div>

                <div className="absolute left-0 right-0 bottom-0 px-4 pb-[18px]">
                  <button
                    onClick={showAnswer}
                    className="w-full text-center mb-4 text-[14px] font-semibold text-muted"
                  >
                    Antwort zeigen
                  </button>
                  <div className="flex items-center gap-2.5">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitAnswer() } }}
                      placeholder={c.dir === "de2tr" ? "Türkisch tippen…" : "Deutsch tippen…"}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="flex-1 h-14 rounded-input bg-surface text-text px-5 text-[17px] font-semibold outline-none"
                      style={{ border: "2px solid #d57b48", fontSize: "17px" }}
                    />
                    <button
                      onClick={submitAnswer}
                      className="w-14 h-14 rounded-full bg-accent text-on-accent flex items-center justify-center text-[23px] font-extrabold flex-shrink-0"
                    >
                      →
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* FEEDBACK: CORRECT */}
            {cardPhase === "feedback" && result?.correct && (
              <>
                <div className="px-[26px] pt-12 text-center">
                  <div className="w-[60px] h-[60px] rounded-full mx-auto mb-5 flex items-center justify-center text-[28px] font-bold text-correct animate-pop"
                    style={{ background: "rgba(155,178,101,.13)", border: "1.5px solid rgba(155,178,101,.5)" }}>
                    ✓
                  </div>
                  <div className="text-[22px] font-extrabold text-correct">Genau!</div>
                </div>
                <div className="px-[26px] pt-[22px] text-center">
                  <div className="text-[38px] font-extrabold tracking-tight">{result.target}</div>
                  <div className="text-[12px] font-extrabold uppercase text-muted mt-2"
                    style={{ letterSpacing: "0.16em" }}>
                    = {result.prompt}
                  </div>
                </div>
                <div className="mx-[22px] mt-[26px] bg-surface border border-border rounded-[22px] flex items-center justify-between px-5 py-4">
                  <span className="text-[14px] font-semibold text-muted">Deine Antwort</span>
                  <span className="text-[16px] font-extrabold text-correct flex items-center gap-2">
                    {result.your} <span>✓</span>
                  </span>
                </div>
                {result.note && (
                  <div className="mx-[26px] mt-5 text-[14.5px] leading-relaxed text-center"
                    style={{ color: "#cdbfae" }}>
                    {result.note}
                  </div>
                )}
              </>
            )}

            {/* FEEDBACK: WRONG */}
            {cardPhase === "feedback" && result && !result.correct && (
              <>
                <div className="px-[26px] pt-10 text-center">
                  <div className="text-[22px] font-extrabold text-wrong">Fast! Schau mal:</div>
                </div>
                <div className="px-[26px] pt-[22px] text-center">
                  <div className="text-[38px] font-extrabold tracking-tight">{result.prompt}</div>
                  <div className="text-[12px] font-extrabold uppercase text-muted mt-2"
                    style={{ letterSpacing: "0.16em" }}>
                    {result.sub}
                  </div>
                </div>
                <div className="mx-[22px] mt-[26px] bg-surface border border-border rounded-[22px] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4"
                    style={{ borderBottom: "1px solid #2e251b" }}>
                    <span className="text-[14px] font-semibold text-muted">Deine Antwort</span>
                    <span className="text-[16px] font-bold text-wrong line-through"
                      style={{ textDecorationColor: "rgba(217,106,82,.55)" }}>
                      {result.your}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-[14px] font-semibold text-muted">Richtig</span>
                    <span className="text-[16px] font-extrabold text-correct">{result.target}</span>
                  </div>
                </div>
                {result.note && (
                  <div className="mx-[26px] mt-5 text-[14.5px] leading-relaxed text-center"
                    style={{ color: "#cdbfae" }}>
                    {result.note}
                  </div>
                )}
              </>
            )}

            {/* REVEAL / SELF-GRADE */}
            {cardPhase === "reveal" && result && (
              <>
                <div className="mx-[22px] mt-11 bg-surface border border-border rounded-card px-[26px] py-10 text-center">
                  <div className="text-[13px] font-extrabold uppercase text-muted"
                    style={{ letterSpacing: "0.1em" }}>
                    {result.prompt} · {result.sub}
                  </div>
                  <div className="text-[40px] font-extrabold tracking-tight mt-[18px]">
                    {result.target}
                  </div>
                  {result.note && (
                    <div className="text-[14px] font-semibold mt-3.5" style={{ color: "#cdbfae" }}>
                      {result.note}
                    </div>
                  )}
                </div>

                <div className="absolute left-0 right-0 bottom-0 px-[22px] pb-[34px]">
                  <div className="text-center text-[15px] font-bold mb-4" style={{ color: "#cdbfae" }}>
                    Konntest du es?
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => selfGrade(false)}
                      className="flex-1 h-[58px] rounded-input flex items-center justify-center text-[16px] font-bold text-wrong"
                      style={{ background: "rgba(217,106,82,.1)", border: "1.5px solid rgba(217,106,82,.45)" }}
                    >
                      Nicht gewusst
                    </button>
                    <button
                      onClick={() => selfGrade(true)}
                      className="flex-1 h-[58px] rounded-input flex items-center justify-center text-[16px] font-bold text-correct"
                      style={{ background: "rgba(155,178,101,.12)", border: "1.5px solid rgba(155,178,101,.5)" }}
                    >
                      Gewusst
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* WEITER button (feedback only) */}
            {cardPhase === "feedback" && (
              <div className="absolute left-[22px] right-[22px] bottom-9">
                <div className="text-center text-[13px] font-semibold text-faint mb-[13px]">
                  → wischen für »Weiter«
                </div>
                <button
                  onClick={nextCard}
                  className="w-full h-[60px] rounded-pill bg-accent text-on-accent flex items-center justify-center text-[18px] font-extrabold"
                >
                  Weiter
                </button>
              </div>
            )}
          </>
        )}

        {/* Exit overlay */}
        {exitOpen && <ExitOverlay onContinue={() => setExitOpen(false)} onEnd={() => router.push("/")} />}
      </div>
    )
  }

  // ---- CHAT SCREEN ----
  return (
    <div className="relative min-h-screen bg-bg max-w-sm mx-auto">
      {/* Status bar */}
      <div className="h-[52px] flex items-center justify-between px-7 pt-2">
        <span className="text-[15px] font-bold">9:41</span>
      </div>

      {/* Chat header */}
      <div className="px-4 pb-[14px] flex items-center gap-2.5">
        <button
          onClick={() => setExitOpen(true)}
          className="w-[38px] h-[38px] rounded-full bg-surface border border-border flex items-center justify-center text-[20px] text-muted flex-shrink-0"
        >
          ‹
        </button>
        <div className="flex-1">
          <div className="text-[11px] font-extrabold uppercase text-muted"
            style={{ letterSpacing: "0.1em", fontFamily: "'Hanken Grotesk', sans-serif" }}>
            Neuer Stoff
          </div>
          <div className="text-[16px] font-extrabold mt-0.5">{phaseLabel || "Phase 1"}</div>
        </div>
        <button
          onClick={endSession}
          className="text-[14px] font-extrabold text-accent-bright px-[14px] py-2 rounded-pill"
          style={{ background: "rgba(213,123,72,.12)" }}
        >
          Fertig
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="absolute top-[142px] left-0 right-0 bottom-[138px] px-[18px] overflow-y-auto flex flex-col gap-[13px]"
      >
        {chat.map((m, i) => (
          <ChatBubble key={i} role={m.role} text={m.text} />
        ))}
        {pending && <ChatBubble role="tutor" text="" isTyping />}
      </div>

      {/* Input dock */}
      <div className="absolute left-0 right-0 bottom-0 px-[14px] pb-4 bg-bg">
        <div className="flex items-center gap-2.5">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendChat() } }}
            placeholder="Auf Türkisch antworten…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 h-[52px] rounded-input bg-surface text-text px-5 text-[16px] font-medium outline-none"
            style={{ border: "1.5px solid #3f3429", fontSize: "16px" }}
          />
          <button
            onClick={sendChat}
            disabled={pending}
            className="w-[52px] h-[52px] rounded-full bg-accent text-on-accent flex items-center justify-center text-[22px] font-extrabold flex-shrink-0 disabled:opacity-50"
          >
            →
          </button>
        </div>
      </div>

      {exitOpen && <ExitOverlay onContinue={() => setExitOpen(false)} onEnd={() => router.push("/")} />}
    </div>
  )
}

function ExitOverlay({ onContinue, onEnd }: { onContinue: () => void; onEnd: () => void }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center px-[26px]"
      style={{ background: "rgba(10,7,4,.74)" }}
    >
      <div className="w-full bg-surface border border-border rounded-card px-[26px] py-[30px] text-center"
        style={{ boxShadow: "0 24px 50px -16px rgba(0,0,0,.7)" }}>
        <div className="text-[22px] font-extrabold">Sitzung beenden?</div>
        <div className="text-[14.5px] font-medium text-muted mt-2.5 leading-relaxed">
          Dein Fortschritt für diese Runde wird gespeichert.
        </div>
        <button
          onClick={onContinue}
          className="w-full h-14 rounded-pill bg-accent text-on-accent flex items-center justify-center text-[17px] font-extrabold mt-6"
        >
          Weiter üben
        </button>
        <button
          onClick={onEnd}
          className="w-full h-[50px] flex items-center justify-center text-[16px] font-bold text-wrong mt-1.5"
        >
          Beenden
        </button>
      </div>
    </div>
  )
}
