import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  betaCostAt,
  betaDescription,
  betaGoldEffects,
  betaLabel,
  betaValueAt,
  type BetaColumn,
  type BetaGreatBuilding,
} from "@/core/gb-beta"

const column = (
  tier: BetaColumn["tier"],
  milestones: Record<number, number>,
  bonus = "clan_goods",
  context = "all",
): BetaColumn => ({
  bonus,
  context,
  tier,
  percent: false,
  milestones: Object.entries(milestones).map(([level, value]) => ({ level: Number(level), value })),
})

// Values read in game on the beta server (October 2026)
describe("beta bonus values", () => {
  it("are exact on milestones and follow the measured curve in between", () => {
    // Saturn VI Gate (copper only): 7 / 488 / 600 at levels 1 / 101 / 200
    const saturn = column("copper", { 1: 7, 101: 488, 200: 600 })
    expect(betaValueAt(saturn, 101)?.value).toBe(488)
    expect(betaValueAt(saturn, 51)?.value).toBe(308)
    expect(betaValueAt(saturn, 127)?.value).toBe(539)
    expect(betaValueAt(saturn, 171)?.value).toBe(585)
    expect(betaValueAt(saturn, 400)?.value).toBe(600)
  })

  it("stops copper growth at level 200 on Gold buildings", () => {
    // Observatory guild goods: milestone 201 holds the level 200 value
    const goods = column("copper", { 1: 35, 101: 860, 201: 1050, 301: 1050, 401: 1050, 500: 1050 })
    expect(betaValueAt(goods, 102)?.value).toBe(864)
    expect(betaValueAt(goods, 152)?.value).toBe(998)
    expect(betaValueAt(goods, 200)?.value).toBe(1050)
  })

  it("locks Gold bonuses before level 101", () => {
    // The Arc, contribution boost (gold)
    const arc = column("gold", { 1: 0, 101: 5, 201: 23, 301: 33, 401: 38, 500: 40 })
    expect(betaValueAt(arc, 100)).toBeNull()
    expect(betaValueAt(arc, 101)?.value).toBe(5)
    expect(betaValueAt(arc, 253)?.value).toBe(29)
    expect(betaValueAt(arc, 500)?.value).toBe(40)
  })

  it("interpolates counts too", () => {
    const strike: BetaColumn = {
      ...column("copper", {}),
      milestones: [
        { level: 1, value: 5, count: 25 },
        { level: 200, value: 30, count: 300 },
      ],
    }
    const value = betaValueAt(strike, 100)!
    expect(value.count).toBeGreaterThan(25)
    expect(value.count).toBeLessThan(300)
  })
})

describe("beta level costs", () => {
  const gb = (firstLevelCost: number, maxLevel: number): BetaGreatBuilding => ({
    maxLevel,
    firstLevelCost,
    columns: [],
  })

  it("are exact up to level 10", () => {
    expect(betaCostAt(gb(84, 500), 7)).toBe(588)
  })

  it("stay within 3% of readings on Gold buildings", () => {
    // The Kraken (100 FP at level 1), level 166: 103,470 FP; The Arc (84), level 253: 228,440 FP
    expect(Math.abs(betaCostAt(gb(100, 500), 166)! / 103470 - 1)).toBeLessThan(0.03)
    expect(Math.abs(betaCostAt(gb(84, 500), 253)! / 228440 - 1)).toBeLessThan(0.03)
  })

  it("add up to the official total at level 500 on Gold buildings", () => {
    let total = 0
    for (let level = 1; level <= 500; level++) total += betaCostAt(gb(84, 500), level)
    expect(Math.abs(total / 755_881_000 - 1)).toBeLessThan(0.01)
  })
})

describe("beta labels", () => {
  it("use the site's names, with the place it applies to", () => {
    expect(betaLabel({ bonus: "money", context: "all" }, "en")).toBe("Coins")
    expect(betaLabel({ bonus: "fierce_resistance", context: "battleground" }, "fr")).toBe(
      "Défenseurs - Attaque et défense (multiplicateur, CBG)",
    )
  })

  it("keep unknown names as sent by the game", () => {
    expect(betaLabel({ bonus: "new_bonus", context: "all" }, "fr")).toBe("new bonus")
  })
})

describe("beta Gold effects", () => {
  const data = JSON.parse(readFileSync("data/gb-beta.json", "utf8")) as {
    buildings: Record<string, BetaGreatBuilding>
  }

  it("all have a description and an icon, in both languages", () => {
    for (const [id, gb] of Object.entries(data.buildings)) {
      for (const column of betaGoldEffects(gb)) {
        expect(betaDescription(column, "fr"), `${id} ${column.bonus}`).toBeTruthy()
        expect(betaDescription(column, "en"), `${id} ${column.bonus}`).not.toContain("{place}")
        expect(column.icon, `${id} ${column.bonus}`).toBeTruthy()
      }
    }
  })
})
