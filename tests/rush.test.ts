import { describe, expect, it } from "vitest"
import type { Prestige } from "@/core/gb-prestige"
import { patronRewards, rushPlan } from "@/core/rush"

// A Gold building: levels 1-10 cost 100 to 1000, then +10 a level
const GOLD: Prestige = {
  gameId: "X_Test_Landmark1",
  maxLevel: 500,
  firstTenCosts: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
  steps: [10, 10, 10, 10, 10, 10],
  columns: [],
}

describe("rush", () => {
  it("applies the arc bonus per place, closed places bring nothing", () => {
    expect(patronRewards([100, 50, 15, 5, 0], [90, 90, 90, 90, 90])).toEqual([190, 95, 29, 10, 0])
    expect(patronRewards([100, 50, 15, 5, 0], [90, null, 0, null, null])).toEqual([
      190, 0, 15, 0, 0,
    ])
  })

  it("sums what the owner pays over the levels", () => {
    const plan = rushPlan({
      prestige: GOLD,
      from: 0,
      to: 2,
      copper: [90, 90, 90, 90, 90],
      gold: [0, 0, 0, 0, 0, 0, 0],
    })
    // Level 1: 25% of 100 -> 15 / 7 / 2 / 2 / 0, x1.9 -> 29 + 13 + 4 + 4 = 50
    expect(plan.levels[0]).toMatchObject({ level: 1, cost: 100, own: 50 })
    expect(plan.cost).toBe(300)
    expect(plan.own).toBe(plan.cost - plan.patrons)
  })

  it("rewards seven places at their Gold arc on Gold levels", () => {
    const plan = rushPlan({
      prestige: GOLD,
      from: 100,
      to: 101,
      copper: [90, 90, 90, 90, 90],
      gold: [10, 10, 10, 10, 10, 10, 10],
    })
    expect(plan.levels[0].places).toHaveLength(7)
  })
})
