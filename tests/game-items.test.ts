import { describe, expect, it } from "vitest"
import type { Building } from "@/core/building"
import { pathLevels } from "@/core/game-item"
import { applyUpgradePaths } from "../scripts/merge-game"

const building = (id: string, gameId?: string, chain?: Building["chain"]): Building => ({
  id,
  name: { fr: id, en: id },
  type: "special",
  size: { w: 2, h: 2 },
  road: "none",
  reliability: "official",
  ages: {},
  ...(gameId && { gameId }),
  ...(chain && { chain }),
})

describe("upgrade paths", () => {
  it("numbers the levels from the base, branches sharing their level", () => {
    expect(
      pathLevels("ship_a", [
        { from: "ship_a", to: "ship_b" },
        { from: "ship_b", to: "ship_royal" },
        { from: "ship_b", to: "ship_pirate" },
      ]),
    ).toEqual({ ship_a: 1, ship_b: 2, ship_royal: 3, ship_pirate: 3 })
  })

  const path = { base: "W_Mill1", levels: { W_Mill1: 1, W_Mill2: 2, W_Mill3: 3 } }

  it("keeps the wiki's chain id and takes the game's levels", () => {
    const result = applyUpgradePaths(
      [
        building("mill_1", "W_Mill1", { id: "mill", level: 1 }),
        building("mill_2", "W_Mill2", { id: "mill", level: 5 }),
        building("noble_mill", "W_Mill3"),
      ],
      [path],
    )
    expect(result.map((b) => b.chain)).toEqual([
      { id: "mill", level: 1 },
      { id: "mill", level: 2 },
      { id: "mill", level: 3 },
    ])
  })

  it("uses the base's id when wiki pages outside the path keep the wiki's chain", () => {
    const result = applyUpgradePaths(
      [
        building("mill_1", "W_Mill1", { id: "mill", level: 1 }),
        building("mill_2", "W_Mill2"),
        building("old_mill_2", undefined, { id: "mill", level: 2 }),
      ],
      [path],
    )
    expect(result.map((b) => b.chain?.id)).toEqual(["w_mill1", "w_mill1", "mill"])
  })
})
