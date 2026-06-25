import { splitTutor } from "@/lib/claude"

type Props = {
  role: "tutor" | "me"
  text: string
  isTyping?: boolean
}

export default function ChatBubble({ role, text, isTyping }: Props) {
  if (isTyping) {
    return (
      <div className="self-start max-w-[84%] bg-surface border border-border-bubble rounded-bubble rounded-bl-[8px] px-4 py-4 flex gap-1.5 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-muted animate-dotpulse"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    )
  }

  if (role === "me") {
    return (
      <div className="self-end max-w-[82%] bg-accent text-on-accent rounded-bubble rounded-br-[8px] px-4 py-[13px] text-[15px] font-semibold leading-relaxed">
        {text}
      </div>
    )
  }

  const { explain, action } = splitTutor(text)

  return (
    <div className="self-start max-w-[84%] bg-surface border border-border-bubble rounded-bubble rounded-bl-[8px] px-4 py-[14px] text-[15px] leading-relaxed text-text-body">
      {explain && <p>{explain}</p>}
      {action && (
        <p className="mt-3 font-extrabold text-text-bright">{action}</p>
      )}
    </div>
  )
}
