// Pure client-safe utilities — no Anthropic SDK, safe to import in components

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
