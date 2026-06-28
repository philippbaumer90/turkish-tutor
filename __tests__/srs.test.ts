import { normalize, gradeAnswer, isDue, leitnerUpdate, INTERVALS } from "@/lib/srs"
import type { CardWithDir } from "@/lib/srs"

const card = (overrides?: Partial<CardWithDir>): CardWithDir => ({
  tr: "yorgun",
  de: "müde",
  added: "2026-06-22",
  last_reviewed: "2026-06-22",
  interval_days: 1,
  box: 1,
  notes: "yorgunum",
  accept: [],
  dir: "de2tr",
  ...overrides,
})

// normalize()
describe("normalize", () => {
  it("lowercases standard latin", () => {
    expect(normalize("MÜDE")).toBe("müde")
  })

  it("maps İ → i (dotted I)", () => {
    expect(normalize("İSTANBUL")).toBe("istanbul")
  })

  it("maps I → ı (dotless I)", () => {
    expect(normalize("KAPIDA")).toBe("kapıda")
  })

  it("does NOT fold ç to c", () => {
    expect(normalize("aç")).toBe("aç")
    expect(normalize("ac")).toBe("ac")
    expect(normalize("aç")).not.toBe(normalize("ac"))
  })

  it("does NOT fold ş to s", () => {
    expect(normalize("şimdi")).toBe("şimdi")
    expect(normalize("simdi")).toBe("simdi")
    expect(normalize("şimdi")).not.toBe(normalize("simdi"))
  })

  it("trims and collapses whitespace", () => {
    expect(normalize("  müde  ")).toBe("müde")
    expect(normalize("guten  morgen")).toBe("guten morgen")
  })

  it("applies NFC normalization", () => {
    // precomposed ç vs base c + combining cedilla
    const precomposed = "ç" // ç
    const combining = "ç"  // c + combining cedilla
    expect(normalize(precomposed)).toBe(normalize(combining))
  })
})

// gradeAnswer()
describe("gradeAnswer", () => {
  it("accepts exact canonical Turkish for de2tr", () => {
    expect(gradeAnswer("yorgun", card())).toBe(true)
  })

  it("accepts case-insensitive Turkish", () => {
    expect(gradeAnswer("Yorgun", card())).toBe(true)
  })

  it("accepts exact German for tr2de", () => {
    const c = card({ dir: "tr2de" })
    expect(gradeAnswer("müde", c)).toBe(true)
  })

  it("accepts accept[] alternates for tr2de", () => {
    const c = card({ de: "Lehrer(in)", accept: ["lehrer", "lehrerin"], dir: "tr2de" })
    expect(gradeAnswer("lehrerin", c)).toBe(true)
    expect(gradeAnswer("Lehrer", c)).toBe(true)
  })

  it("rejects c instead of ç", () => {
    const c = card({ tr: "aç" })
    expect(gradeAnswer("ac", c)).toBe(false)
  })

  it("rejects s instead of ş", () => {
    const c = card({ tr: "şimdi" })
    expect(gradeAnswer("simdi", c)).toBe(false)
  })

  it("rejects wrong answer", () => {
    expect(gradeAnswer("iyi", card())).toBe(false)
  })

  it("accepts with extra whitespace", () => {
    expect(gradeAnswer("  yorgun  ", card())).toBe(true)
  })
})

// gradeAnswer() — multi-gloss cards where `de` crams several meanings + an
// annotation into one string (e.g. "dein / du (Besitzpronomen)") and accept[]
// was never populated. A single correct meaning must count as correct.
describe("gradeAnswer multi-gloss", () => {
  const senin = card({
    tr: "senin",
    de: "dein / du (Besitzpronomen)",
    accept: [],
    dir: "tr2de",
  })

  it("accepts the first slash-separated meaning alone", () => {
    expect(gradeAnswer("dein", senin)).toBe(true)
  })

  it("accepts the second slash-separated meaning alone", () => {
    expect(gradeAnswer("du", senin)).toBe(true)
  })

  it("accepts the full stored gloss string", () => {
    expect(gradeAnswer("dein / du (Besitzpronomen)", senin)).toBe(true)
  })

  it("does not accept the parenthetical annotation as an answer", () => {
    expect(gradeAnswer("Besitzpronomen", senin)).toBe(false)
  })

  it("still rejects a genuinely wrong answer", () => {
    expect(gradeAnswer("evet", senin)).toBe(false)
  })

  it("does not split on bare commas (a comma gloss is one phrase)", () => {
    const c = card({ tr: "x", de: "Hallo, Guten Tag", accept: [], dir: "tr2de" })
    expect(gradeAnswer("hallo", c)).toBe(false)
    expect(gradeAnswer("Hallo, Guten Tag", c)).toBe(true)
  })

  it("does not split the Turkish target on de2tr (canonical answer is exact)", () => {
    const c = card({ tr: "merhaba, nasılsın", de: "hallo, wie geht's", dir: "de2tr" })
    expect(gradeAnswer("merhaba", c)).toBe(false)
    expect(gradeAnswer("merhaba, nasılsın", c)).toBe(true)
  })
})

// isDue()
describe("isDue", () => {
  it("is due when last_reviewed + interval_days = today (boundary inclusive)", () => {
    const c = card({ last_reviewed: "2026-06-24", interval_days: 1 })
    expect(isDue(c, "2026-06-25")).toBe(true)
  })

  it("is due when overdue", () => {
    const c = card({ last_reviewed: "2026-06-20", interval_days: 1 })
    expect(isDue(c, "2026-06-25")).toBe(true)
  })

  it("is NOT due when reviewed today (interval = 1)", () => {
    const c = card({ last_reviewed: "2026-06-25", interval_days: 1 })
    expect(isDue(c, "2026-06-25")).toBe(false)
  })

  it("is due when null last_reviewed", () => {
    const c = card({ last_reviewed: null })
    expect(isDue(c, "2026-06-25")).toBe(true)
  })
})

// leitnerUpdate()
describe("leitnerUpdate", () => {
  it("advances box on correct", () => {
    const c = card({ box: 1 })
    const updated = leitnerUpdate(c, true, "2026-06-25")
    expect(updated.box).toBe(2)
    expect(updated.interval_days).toBe(INTERVALS[1])
    expect(updated.last_reviewed).toBe("2026-06-25")
  })

  it("caps at box 5", () => {
    const c = card({ box: 5 })
    const updated = leitnerUpdate(c, true, "2026-06-25")
    expect(updated.box).toBe(5)
    expect(updated.interval_days).toBe(INTERVALS[4])
  })

  it("resets to box 1 on wrong", () => {
    const c = card({ box: 4 })
    const updated = leitnerUpdate(c, false, "2026-06-25")
    expect(updated.box).toBe(1)
    expect(updated.interval_days).toBe(INTERVALS[0])
  })

  it("sets correct interval for each box", () => {
    for (let box = 1; box <= 5; box++) {
      const c = card({ box })
      const updated = leitnerUpdate(c, true, "2026-06-25")
      const expectedBox = Math.min(5, box + 1)
      expect(updated.interval_days).toBe(INTERVALS[expectedBox - 1])
    }
  })
})
