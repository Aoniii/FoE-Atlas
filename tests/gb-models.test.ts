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

describe("Galata Tower models", () => {
  const count = MANUAL_GB_MODELS.galata_tower["Plunder Repel (#)"]
  const percent = MANUAL_GB_MODELS.galata_tower["Plunder Repel (%)"]

  it("keeps 6 plunder repels", () => {
    expect(count.value(150)).toBe(6)
  })

  it("stays within 0.05 point of the readings", () => {
    for (const [level, reading] of Object.entries(percent.readings!)) {
      expect(Math.abs(percent.value(Number(level)) - reading)).toBeLessThan(0.05)
    }
  })

  it("never decreases up to level 400", () => {
    for (let level = 81; level < 400; level++) {
      expect(percent.value(level + 1)).toBeGreaterThanOrEqual(percent.value(level))
    }
  })
})

describe("Rain Forest Project model", () => {
  const aid = MANUAL_GB_MODELS.rain_forest_project["Aid Blueprints"]

  it("follows the wiki at level 80 and the readings within 1 point", () => {
    expect(aid.value(80)).toBe(463)
    for (const [level, reading] of Object.entries(aid.readings!)) {
      expect(Math.abs(aid.value(Number(level)) - reading)).toBeLessThanOrEqual(1)
    }
  })

  it("never decreases up to level 400", () => {
    for (let level = 81; level < 400; level++) {
      expect(aid.value(level + 1)).toBeGreaterThanOrEqual(aid.value(level))
    }
  })
})
