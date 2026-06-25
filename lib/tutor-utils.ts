// Pure client-safe utilities — no Anthropic SDK, safe to import in components

// Exact implementation from design handoff README
export function splitTutor(text: string): { explain: string; action: string } {
  const t = (text || "").trim()
  const q = t.lastIndexOf("?")
  if (q === -1) return { explain: t, action: "" }
  let start = 0
  for (let i = q - 1; i >= 0; i--) {
    const c = t[i]
    if (c === "." || c === "!" || c === "?" || c === "…") {
      start = i + 1
      break
    }
  }
  return {
    explain: t.slice(0, start).trim(),
    action: t.slice(start, q + 1).trim(),
  }
}

export function collectTerms(existing: string[], text: string): string[] {
  const set = new Set(existing)
  const parts = text.split("**")
  parts.forEach((s, i) => {
    if (i % 2 === 1) {
      const w = (s || "").replace(/[^A-Za-zçşğüöıİÇŞĞÜÖI]/g, "")
      if (w.length > 1) set.add(w)
    }
  })
  return Array.from(set)
}
