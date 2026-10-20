import { describe, expect, it } from "vitest"
import { MANUAL_GB_MODELS, manualValue } from "@/core/gb-models"

const relic = MANUAL_GB_MODELS.temple_of_relics["Relic Hunt (%)"]
const rare = MANUAL_GB_MODELS.temple_of_relics["Relic Hunt (Rare Totem %)"]

describe("Temple of Relics models", () => {
  it("uses in-game readings at their level", () => {
    expect(manualValue(relic, 150)).toBe(34)
    expect(manualValue(rare, 171)).toBe(26.93)
  })

  it("matches the wiki around level 80", () => {
    expect(relic.value(80)).toBe(32)
    expect(Math.abs(rare.value(80) - 18.04)).toBeLessThan(0.1)
  })

  it("keeps growing slowly without decreasing", () => {
    for (let level = 81; level < 400; level++) {
      expect(relic.value(level + 1)).toBeGreaterThanOrEqual(relic.value(level))
      expect(rare.value(level + 1)).toBeGreaterThanOrEqual(rare.value(level))
    }
  })
})
