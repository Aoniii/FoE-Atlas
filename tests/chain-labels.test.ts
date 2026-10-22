import { describe, expect, it } from "vitest"
import { chainStepLabels } from "@/wiki/chain-labels"

const step = (id: string, level: number, fr: string, en: string) => ({
  id,
  level,
  name: { fr, en },
})

describe("chain step labels", () => {
  const labels = chainStepLabels([
    step("lv1", 1, "Moulin à eau de Whisperwood - Niv. 1", "Whisperwood Watermill - Lv. 1"),
    step("lv8", 8, "Moulin à eau de Whisperwood - Niv. 8", "Whisperwood Watermill - Lv. 8"),
    step("sylvan", 9, "Moulin à eau de Whisperwood sylvestre", "Sylvan Whisperwood Watermill"),
    step(
      "elysian",
      11,
      "Moulin à eau du bois murmurant paradisiaque",
      "Elysian Whisperwood Watermill",
    ),
    step(
      "ascended",
      12,
      "Moulin à eau du bois murmurant paradisiaque supérieur",
      "Ascended Elysian Whisperwood Watermill",
    ),
  ])

  it("shows numbers for numbered levels", () => {
    expect(labels.get("lv8")).toEqual({ fr: "8", en: "8" })
  })

  it("keeps only what kit upgrades add", () => {
    expect(labels.get("sylvan")).toEqual({ fr: "Sylvestre", en: "Sylvan" })
    expect(labels.get("elysian")).toEqual({ fr: "Paradisiaque", en: "Elysian" })
    expect(labels.get("ascended")).toEqual({
      fr: "Paradisiaque supérieur",
      en: "Ascended Elysian",
    })
  })

  it("shows the full name of a renamed step", () => {
    const renamed = chainStepLabels([
      step("lv9", 9, "Réserve de pandas - Niv. 9", "Panda Reserve - Lv. 9"),
      step("shrine", 10, "Sanctuaire du panda", "Panda Shrine"),
    ])
    expect(renamed.get("shrine")).toEqual({ fr: "Sanctuaire du panda", en: "Panda Shrine" })
  })
})
