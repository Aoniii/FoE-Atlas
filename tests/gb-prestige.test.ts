import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bonusDescription,
  bonusLabel,
  goldEffects,
  patronBaseRewards,
  placeCount,
  prestigeCostAt,
  prestigeValueAt,
  type Prestige,
  type PrestigeColumn,
} from "@/core/gb-prestige"

const column = (
  tier: PrestigeColumn["tier"],
  milestones: Record<number, number>,
  bonus = "clan_goods",
  context = "all",
): PrestigeColumn => ({
  bonus,
  context,
  tier,
  percent: false,
  milestones: Object.entries(milestones).map(([level, value]) => ({ level: Number(level), value })),
})

// Values read in game (October 2026), within one of the curve
const near = (actual: number | undefined, expected: number) =>
  expect(Math.abs((actual ?? NaN) - expected)).toBeLessThanOrEqual(1)

describe("prestige bonus values", () => {
  it("are exact on breakpoints and follow the game's curve in between", () => {
    // Saturn VI Gate (copper only): 7 / 488 / 600 at levels 1 / 101 / 200
    const saturn = column("copper", { 1: 7, 101: 488, 200: 600 })
    expect(prestigeValueAt(saturn, 101)?.value).toBe(488)
    near(prestigeValueAt(saturn, 51)?.value, 308)
    near(prestigeValueAt(saturn, 127)?.value, 539)
    near(prestigeValueAt(saturn, 171)?.value, 585)
    expect(prestigeValueAt(saturn, 200)?.value).toBe(600)
  })

  it("stops copper growth at level 200 on Gold buildings", () => {
    // Observatory guild goods: breakpoint 201 holds the level 200 value
    const goods = column("copper", { 1: 35, 101: 860, 201: 1050, 301: 1050, 401: 1050, 500: 1050 })
    near(prestigeValueAt(goods, 102)?.value, 864)
    near(prestigeValueAt(goods, 152)?.value, 998)
    expect(prestigeValueAt(goods, 200)?.value).toBe(1050)
    expect(prestigeValueAt(goods, 450)?.value).toBe(1050)
  })

  it("locks Gold bonuses before level 101", () => {
    // The Arc, contribution boost (gold)
    const arc = column("gold", { 1: 0, 101: 5, 201: 23, 301: 33, 401: 38, 500: 40 })
    expect(prestigeValueAt(arc, 100)).toBeNull()
    expect(prestigeValueAt(arc, 101)?.value).toBe(5)
    near(prestigeValueAt(arc, 253)?.value, 29)
    expect(prestigeValueAt(arc, 500)?.value).toBe(40)
  })

  it("follows counts too", () => {
    const strike: PrestigeColumn = {
      ...column("copper", {}),
      milestones: [
        { level: 1, value: 5, count: 25 },
        { level: 101, value: 20, count: 200 },
        { level: 200, value: 30, count: 300 },
      ],
    }
    const value = prestigeValueAt(strike, 50)!
    expect(value.count).toBeGreaterThan(25)
    expect(value.count).toBeLessThan(200)
  })
})

describe("prestige level costs and patron rewards", () => {
  const data = JSON.parse(readFileSync("data/gb-prestige.json", "utf8")) as {
    buildings: Record<string, Prestige>
  }
  const costs = JSON.parse(readFileSync("data/gb-rewards.json", "utf8")) as {
    steps: Record<string, number[]>
  }
  const withSteps = (id: string): Prestige => {
    const gb = data.buildings[id]
    return { ...gb, steps: costs.steps[gb.gameId] }
  }
  const total = (gb: Prestige) => {
    let sum = 0
    for (let level = 1; level <= gb.maxLevel; level++) sum += prestigeCostAt(gb, level)!
    return sum
  }

  it("add up to the costs InnoGames announced", () => {
    expect(total(withSteps("alcatraz"))).toBe(755_832_405)
    expect(total(withSteps("observatory"))).toBe(755_774_620)
    // Copper only, announced rounded to the thousand
    expect(Math.round(total(withSteps("lighthouse_of_alexandria")) / 1000) * 1000).toBe(5_508_000)
  })

  it("reward five places on copper levels, seven on Gold levels", () => {
    const alcatraz = withSteps("alcatraz")
    expect(placeCount(alcatraz, 100)).toBe(5)
    expect(placeCount(alcatraz, 101)).toBe(7)
    expect(placeCount(withSteps("lighthouse_of_alexandria"), 150)).toBe(5)
    // 25% of 100 FP split 120 : 60 : 20 : 5 : 1 (of 206); the game turns a reward of 1 into 2
    expect(patronBaseRewards(alcatraz, 5, 100)).toEqual([15, 7, 2, 2, 0])
  })
})

describe("prestige labels", () => {
  it("use the site's names, with the place it applies to", () => {
    expect(bonusLabel({ bonus: "money", context: "all" }, "en")).toBe("Coins")
    expect(bonusLabel({ bonus: "fierce_resistance", context: "battleground" }, "fr")).toBe(
      "Défenseurs - Attaque et défense (multiplicateur, CBG)",
    )
  })

  it("keep unknown names as sent by the game", () => {
    expect(bonusLabel({ bonus: "new_bonus", context: "all" }, "fr")).toBe("new bonus")
  })
})

describe("Gold effects", () => {
  const data = JSON.parse(readFileSync("data/gb-prestige.json", "utf8")) as {
    buildings: Record<string, Prestige>
  }

  it("all have a description and an icon, in both languages", () => {
    for (const [id, gb] of Object.entries(data.buildings)) {
      for (const column of goldEffects(gb)) {
        expect(bonusDescription(column, "fr"), `${id} ${column.bonus}`).toBeTruthy()
        expect(bonusDescription(column, "en"), `${id} ${column.bonus}`).not.toContain("{place}")
        expect(column.icon, `${id} ${column.bonus}`).toBeTruthy()
      }
    }
  })
})
