import { classify, type GrammarConcept } from "@/lib/grammar"

const base: GrammarConcept = {
  id: "x",
  name: "X",
  phase: 2,
  form: "",
  meaning: "",
  use: "",
  examples: [],
  keywords: ["akkusativ"],
}

describe("classify", () => {
  it("needsReview when a keyword starts a word in a weak spot", () => {
    expect(
      classify(base, { phase: 6, weak_spots: ["Akkusativ-Endungen"] })
    ).toBe("needsReview")
  })

  it("does NOT match a keyword that is only an interior substring", () => {
    // "mein" must not flag Possessiv from "allgemeine"; "ort" must not flag
    // Lokativ from "Wort" — these were false positives under plain .includes().
    const possessiv: GrammarConcept = { ...base, phase: 5, keywords: ["possessiv", "mein"] }
    expect(classify(possessiv, { phase: 6, weak_spots: ["allgemeine Verbformen"] })).toBe("learned")
    const lokativ: GrammarConcept = { ...base, phase: 4, keywords: ["lokativ", "ort"] }
    expect(classify(lokativ, { phase: 6, weak_spots: ["falsche Wortstellung"] })).toBe("learned")
  })

  it("learned when phase <= current and no weak-spot hit", () => {
    expect(classify(base, { phase: 4, weak_spots: [] })).toBe("learned")
  })

  it("upcoming when phase > current", () => {
    expect(classify(base, { phase: 1, weak_spots: [] })).toBe("upcoming")
  })
})
