import { describe, expect, it } from "vitest"
import { eraId, levelCost, p1Reward, patronRewards, rushPlan } from "@/core/rush"

// Colosseum (Iron Age), costs of levels 1-10 from the official wiki
const COLOSSEUM = [40, 60, 120, 170, 220, 290, 360, 420, 490, 550]

describe("rush", () => {
  it("maps ages to FoE Helper era ids", () => {
    expect(eraId("BronzeAge")).toBe(2)
    expect(eraId("IronAge")).toBe(3)
    expect(eraId("StellarAgeDiscovery")).toBe(24)
    expect(eraId(undefined)).toBe(0)
  })

  it("computes level costs, +2.5% per level after 10", () => {
    expect(levelCost(COLOSSEUM, 10)).toBe(550)
    expect(levelCost(COLOSSEUM, 11)).toBe(564)
    expect(levelCost(COLOSSEUM, 80)).toBe(Math.ceil(550 * 1.025 ** 70))
  })

  it("derives places 2-5 from P1 and applies the arc bonus per place", () => {
    // base 100 / 50 / 15 / 5 / 0, x1.9
    expect(patronRewards(100, [90, 90, 90, 90, 90])).toEqual([190, 95, 29, 10, 0])
    // closed places bring nothing
    expect(patronRewards(100, [90, null, 0, null, null])).toEqual([190, 0, 15, 0, 0])
  })

  it("uses the reward table, then the estimated curve", () => {
    const tables = { 3: [5, 10], 4: [5, 10, 15] }
    expect(p1Reward(tables, [], 3, 2)).toEqual({ reward: 10, estimated: false })
    expect(p1Reward(tables, [1.1, 1.2, 1.5], 3, 3)).toEqual({ reward: 20, estimated: true })
  })

  it("sums what the owner pays over the levels", () => {
    const plan = rushPlan({
      firstTenCosts: COLOSSEUM,
      tables: { 3: [5, 10, 15] },
      age: "IronAge",
      from: 0,
      to: 3,
      arcs: [90, 90, 90, 90, 90],
    })
    // P1 5 -> base 5/5/0/0/0 -> x1.9: 10 + 10 = 20
    // P1 10 -> base 10/5/0/0/0 -> 19 + 10 = 29
    // P1 15 -> base 15/10/5/0/0 -> 29 + 19 + 10 = 58
    expect(plan.levels.map((l) => l.own)).toEqual([40 - 20, 60 - 29, 120 - 58])
    expect(plan.own).toBe(20 + 31 + 62)
    expect(plan.cost).toBe(40 + 60 + 120)
  })
})
