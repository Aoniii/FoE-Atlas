import { describe, expect, it } from "vitest"
import { chooseProduction } from "../scripts/production-choice"

const stat = (stat: "fp" | "goods" | "supplies" | "coins", amount: number) =>
  ({ type: "stat", stat, amount }) as const

describe("production choices", () => {
  // Insect Hotel (Oceanic Future): supplies 5 min, coins 15 min, FP 8h, goods 24h
  const insectHotel = [
    { time: 300, rewards: [stat("supplies", 240)] },
    { time: 900, rewards: [stat("coins", 1250)] },
    { time: 28800, rewards: [stat("fp", 2)] },
    { time: 86400, rewards: [stat("goods", 13)] },
  ]

  it("counts half the best FP option and half the best goods option over 3 collections a day", () => {
    expect(chooseProduction(insectHotel)).toEqual([
      {
        kind: "random",
        options: [
          { chance: 50, rewards: [stat("fp", 6)] },
          { chance: 50, rewards: [stat("goods", 13)] },
        ],
      },
    ])
  })

  it("keeps the best option without FP or goods", () => {
    const workshop = [
      { time: 300, rewards: [stat("supplies", 100)] },
      { time: 28800, rewards: [stat("supplies", 1000)] },
      { time: 86400, rewards: [stat("supplies", 2000)] },
    ]
    expect(chooseProduction(workshop)).toEqual([
      { kind: "guaranteed", rewards: [stat("supplies", 3000)] },
    ])
  })
})
