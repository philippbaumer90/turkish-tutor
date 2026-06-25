import { Fragment, type ReactNode } from "react"

type Props = {
  role: "tutor" | "me"
  text: string
  isTyping?: boolean
}

// Inline formatting: **bold** spans. Dependency-free so it stays client-safe
// and tolerates streamed (possibly half-finished) markdown.
function renderInline(text: string): ReactNode[] {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-extrabold text-text-bright">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  )
}

// A GFM separator row, e.g. |---|---|  or | :-- | --: |
function isTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line)
}

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith("|")) s = s.slice(1)
  if (s.endsWith("|")) s = s.slice(0, -1)
  return s.split("|").map((c) => c.trim())
}

// Block-level rendering: tables, horizontal rules, and paragraphs (with line
// breaks). Built to degrade gracefully while a message is still streaming —
// an incomplete table simply renders as text until its separator row arrives.
function renderRich(text: string): ReactNode[] {
  const lines = text.split("\n")
  const blocks: ReactNode[] = []
  let para: string[] = []
  let key = 0

  function flushPara() {
    if (!para.length) return
    const content = para
    blocks.push(
      <p key={key++} className="whitespace-pre-wrap">
        {content.map((ln, i) => (
          <Fragment key={i}>
            {renderInline(ln)}
            {i < content.length - 1 && <br />}
          </Fragment>
        ))}
      </p>
    )
    para = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Horizontal rule
    if (/^\s*---+\s*$/.test(line)) {
      flushPara()
      blocks.push(<hr key={key++} className="border-0 border-t border-border-bubble my-3" />)
      continue
    }

    // Table = a row of cells immediately followed by a separator row
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushPara()
      const header = splitRow(line)
      const rows: string[][] = []
      let j = i + 2
      while (j < lines.length && lines[j].includes("|") && lines[j].trim() !== "") {
        rows.push(splitRow(lines[j]))
        j++
      }
      blocks.push(
        <div key={key++} className="overflow-x-auto -mx-1 my-2">
          <table className="w-full border-collapse text-[13.5px] leading-snug">
            <thead>
              <tr>
                {header.map((h, hi) => (
                  <th
                    key={hi}
                    className="border border-border-bubble px-2.5 py-1.5 text-left font-extrabold text-text-bright align-top"
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="border border-border-bubble px-2.5 py-1.5 align-top">
                      {renderInline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      i = j - 1
      continue
    }

    para.push(line)
  }
  flushPara()
  return blocks
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
    <div className="self-start max-w-[92%] bg-surface border border-border-bubble rounded-bubble rounded-bl-[8px] px-4 py-[14px] text-[15px] leading-relaxed text-text-body space-y-1">
      {renderRich(text)}
    </div>
  )
}
