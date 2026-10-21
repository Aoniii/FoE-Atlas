import { describe, expect, it } from "vitest"
import { betaLabel, betaMaxLevel, type BetaColumn } from "@/core/gb-beta"

const column = (tier: BetaColumn["tier"], bonus = "clan goods", context = "all"): BetaColumn => ({
  bonus,
  context,
  tier,
  percent: false,
})
// Value of every column at each level, null before it unlocks
const rows = (count: number, value: (level: number) => (number | null)[]) =>
  Array.from({ length: count }, (_, i) => ({
    level: i + 1,
    cost: 10,
    values: value(i + 1).map((v) => (v === null ? null : { value: v })),
  }))

describe("beta max level", () => {
  it("stops at 200 with copper bonuses only", () => {
    expect(
      betaMaxLevel(
        [column("copper")],
        rows(400, (l) => [l]),
      ),
    ).toBe(200)
  })

  it("goes up to the last level a bonus still grows", () => {
    const columns = [column("copper"), column("silver")]
    expect(
      betaMaxLevel(
        columns,
        rows(400, (l) => [Math.min(l, 200), l > 100 ? Math.min(l, 300) : null]),
      ),
    ).toBe(300)
  })

  it("never goes below 200", () => {
    const columns = [column("copper"), column("gold")]
    expect(
      betaMaxLevel(
        columns,
        rows(400, (l) => [Math.min(l, 150), l > 100 ? 5 : null]),
      ),
    ).toBe(200)
  })
})

describe("beta labels", () => {
  it("uses the site's names, with the place it applies to", () => {
    expect(betaLabel(column("silver", "defense boost", "battleground"), "fr")).toBe(
      "Défenseurs - Défense (CBG)",
    )
    expect(betaLabel(column("copper", "money"), "en")).toBe("Coins")
  })

  it("keeps unknown names as written on the beta", () => {
    expect(betaLabel(column("gold", "new bonus"), "fr")).toBe("new bonus")
  })
})
