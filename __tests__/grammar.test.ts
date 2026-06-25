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
  it("needsReview when a keyword is a substring of a weak spot", () => {
    expect(
      classify(base, { phase: 6, weak_spots: ["Akkusativ-Endungen"] })
    ).toBe("needsReview")
  })

  it("learned when phase <= current and no weak-spot hit", () => {
    expect(classify(base, { phase: 4, weak_spots: [] })).toBe("learned")
  })

  it("upcoming when phase > current", () => {
    expect(classify(base, { phase: 1, weak_spots: [] })).toBe("upcoming")
  })
})
