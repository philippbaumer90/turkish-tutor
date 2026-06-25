type Props = { current: number; total: number; onExit: () => void }

export default function ProgressBar({ current, total, onExit }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="px-6 pt-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[14px] font-extrabold text-on-accent bg-accent px-[15px] py-[7px] rounded-pill">
          {current} / {total}
        </span>
        <button
          onClick={onExit}
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-[16px] text-muted"
        >
          ✕
        </button>
      </div>
      <div className="h-[6px] rounded-pill bg-surface-raised overflow-hidden">
        <div
          className="h-full bg-accent rounded-pill transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
