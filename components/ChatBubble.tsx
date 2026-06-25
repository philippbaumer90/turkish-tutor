import { Fragment } from "react"

type Props = {
  role: "tutor" | "me"
  text: string
  isTyping?: boolean
}

// Render **bold** spans and preserve paragraph breaks. Dependency-free so it
// stays client-safe and handles streamed (possibly half-finished) markdown.
function renderRich(text: string) {
  return text.split("\n").map((line, li, lines) => (
    <Fragment key={li}>
      {line.split("**").map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-extrabold text-text-bright">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
      {li < lines.length - 1 && <br />}
    </Fragment>
  ))
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

  return (
    <div className="self-start max-w-[84%] bg-surface border border-border-bubble rounded-bubble rounded-bl-[8px] px-4 py-[14px] text-[15px] leading-relaxed text-text-body whitespace-pre-wrap">
      {renderRich(text)}
    </div>
  )
}
