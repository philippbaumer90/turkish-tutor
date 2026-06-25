type BoxMove = { tr: string; de: string; from: number; to: number }

type Props = {
  reviewed: number
  correct: number
  boxMoves: BoxMove[]
  newWords: { tr: string; de: string }[]
  nextDueText: string
  streak: number
  onFinish: () => void
}

export default function SessionSummary({
  reviewed,
  correct,
  boxMoves,
  newWords,
  nextDueText,
  streak,
  onFinish,
}: Props) {
  return (
    <div className="relative min-h-[100dvh] bg-bg w-full max-w-md mx-auto flex flex-col pt-safe">
      <div className="px-[26px] pt-[26px] text-center">
        <h1 className="text-[30px] font-extrabold tracking-tight">Super gemacht!</h1>
        <p className="text-[15px] font-medium text-muted mt-1.5">
          {streak}. Tag in Folge — weiter so.
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-3 px-[22px] mt-6">
        <div className="flex-1 bg-surface border border-border rounded-[20px] p-[18px] text-center">
          <div className="text-[32px] font-extrabold">{reviewed}</div>
          <div className="text-[13px] font-semibold text-muted mt-0.5">wiederholt</div>
        </div>
        <div className="flex-1 rounded-[20px] p-[18px] text-center"
          style={{ background: "rgba(155,178,101,.1)", border: "1px solid rgba(155,178,101,.35)" }}>
          <div className="text-[32px] font-extrabold text-correct">{correct}</div>
          <div className="text-[13px] font-semibold text-muted mt-0.5">richtig</div>
        </div>
      </div>

      {/* Box moves */}
      {boxMoves.length > 0 && (
        <div className="mx-[22px] mt-[22px] bg-surface border border-border rounded-[20px] px-[18px] py-1.5">
          {boxMoves.slice(0, 5).map((m, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-3 text-[15.5px]"
              style={{ borderBottom: i < Math.min(boxMoves.length, 5) - 1 ? "1px solid #2e251b" : "none" }}
            >
              <span className="font-bold">{m.tr}</span>
              {m.to > m.from ? (
                <span className="font-extrabold text-correct">↑ Box {m.to}</span>
              ) : (
                <span className="font-extrabold text-wrong">↓ Box {m.to}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Meta rows */}
      <div className="mx-[22px] mt-[18px] flex flex-col gap-[11px]">
        <div className="flex items-center justify-between text-[15px]">
          <span className="font-semibold" style={{ color: "#cdbfae" }}>Neu im Chat</span>
          <span className="font-semibold text-muted">
            {newWords.length > 0 ? newWords.map((w) => w.tr).join(" · ") : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between text-[15px]">
          <span className="font-semibold" style={{ color: "#cdbfae" }}>Nächste Wiederholung</span>
          <span className="font-extrabold text-accent-bright">{nextDueText}</span>
        </div>
      </div>

      {/* Fertig button */}
      <div className="absolute bottom-0 left-0 right-0 w-full max-w-md mx-auto px-[22px] pb-9">
        <button
          onClick={onFinish}
          className="w-full h-[60px] rounded-pill bg-accent text-on-accent flex items-center justify-center text-[18px] font-extrabold"
        >
          Fertig
        </button>
      </div>
    </div>
  )
}
