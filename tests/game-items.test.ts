import { describe, expect, it } from "vitest"
import type { Building } from "@/core/building"
import { pathLevels } from "@/core/game-item"
import { fromStaticData } from "../scripts/game-data"
import { applyUpgradePaths, joinCodePages } from "../scripts/merge-game"

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

describe("static server definitions", () => {
  it("drops the class and enum keys and takes the type from the tags", () => {
    const def = fromStaticData({
      id: "W_MultiAge_WIN24E1",
      name: "Maison",
      __class__: "CityEntity",
      components: {
        AllAge: {
          placement: {
            allowedPlacements: [
              { gridId: "main", sector: { __enum__: "Sector", value: "Regular" } },
            ],
          },
          tags: { tags: [{ tag: "buildingType", buildingType: "residential" }] },
        },
      },
    })
    expect(def.type).toBe("residential")
    expect(JSON.stringify(def)).not.toMatch(/__class__|__enum__/)
  })
})

describe("wiki pages named by the game's code", () => {
  const page = (id: string, en: string, fr: string, picture: string): Building => ({
    ...building(id),
    name: { en, fr },
    image: `https://foeen.innogamescdn.com/assets/city/buildings/W_SS_MultiAge_${picture}.png`,
  })

  it("joins the two pages of one building, real names kept", () => {
    const joined = joinCodePages([
      page("homeward_bus_stop_diner", "Homeward Bus Stop Diner", "WIN26E", "WIN26E1-433e51485"),
      page("win26e", "WIN26E", "Restaurant de l'arrêt de bus du retour", "WIN26E1-f736c4d85"),
    ])
    expect(joined.map((b) => [b.id, b.name.en, b.name.fr])).toEqual([
      [
        "homeward_bus_stop_diner",
        "Homeward Bus Stop Diner",
        "Restaurant de l'arrêt de bus du retour",
      ],
    ])
  })

  it("keeps apart levels sharing a picture", () => {
    const pages = [
      page("tower_lv_1", "Tidings Press Tower - Lv. 1", "WIN26A", "WIN26A1-1ca18c3db"),
      page(
        "tower_lv_2",
        "Tidings Press Tower - Lv. 2",
        "Tour des nouvelles - Niv. 2",
        "WIN26A1-1ca18c3db",
      ),
      page("win26a", "WIN26A", "Tour des nouvelles - Niv. 1", "WIN26A1-c50d279c9"),
    ]
    expect(joinCodePages(pages).map((b) => [b.id, b.name.fr])).toEqual([
      ["tower_lv_1", "Tour des nouvelles - Niv. 1"],
      ["tower_lv_2", "Tour des nouvelles - Niv. 2"],
    ])
  })
})
