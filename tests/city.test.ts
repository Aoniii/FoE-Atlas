import { describe, expect, it } from "vitest"
import type { AgeBuilding } from "@/core/building"
import type { GreatBuilding } from "@/core/great-building"
import {
  FoeHelperFormatError,
  greatBuildingStats,
  parseFoeHelperExport,
  rateCity,
  worldLabel,
  type City,
} from "@/core/city"

const building = (id: string, fp: number) =>
  ({
    id,
    name: { fr: id, en: id },
    type: "special",
    image: `https://foeen.innogamescdn.com/assets/city/buildings/W_SS_${id}-abc123.png`,
    size: { w: 2, h: 2 },
    road: "none",
    reliability: "official",
    age: { passive: { fp }, production: [] },
  }) as unknown as AgeBuilding

const city = (ids: string[]): City => ({
  world: "fr12",
  playerId: 1,
  entities: ids.map((id, i) => ({ id, x: i, y: 0, connected: true })),
})

describe("city rating", () => {
  const assets = { buildings: { W_A: "a", W_B: "b" }, greatBuildings: {} }
  const buildings = [building("a", 10), building("b", 40)]

  it("counts each known building and rates it", () => {
    const { rows } = rateCity(
      city(["W_A", "W_A", "W_B"]),
      assets,
      { BronzeAge: buildings },
      {},
      "BronzeAge",
      ["fp"],
    )
    expect(rows.map((row) => [row.id, row.count])).toEqual([
      ["a", 2],
      ["b", 1],
    ])
    expect(rows[1].score).toBeGreaterThan(rows[0].score)
  })

  it("lists unknown buildings apart, by name", () => {
    const rated = rateCity(
      {
        ...city([]),
        entities: [{ id: "H_Townhall", name: "Town Hall", x: 0, y: 0, connected: true }],
      },
      assets,
      { BronzeAge: buildings },
      {},
      "BronzeAge",
      ["fp"],
    )
    expect(rated.rows).toEqual([])
    expect(rated.unknown).toEqual([{ name: "Town Hall", count: 1 }])
  })
})

describe("world labels", () => {
  it("names servers and the beta", () => {
    expect(worldLabel("fr12")).toBe("FR 12")
    expect(worldLabel("zz1")).toBe("Beta")
  })
})

describe("FoE Helper export", () => {
  const exported = {
    CityMapData: {
      "1": {
        cityentity_id: "H_SpaceAgeTitan_Townhall",
        type: "main_building",
        x: 8,
        y: 17,
        connected: 1,
      },
      "5": { cityentity_id: "S_StoneAge_Street", type: "street", x: 1, y: 1, connected: 1 },
      "9": { cityentity_id: "W_MultiAge_PAT24B3", type: "generic_building", x: 3, y: 4 },
    },
    UnlockedAreas: [],
    CityEntities: {
      H_SpaceAgeTitan_Townhall: { asset_id: "H_SpaceAgeTitan_Townhall", name: "Town Hall" },
      W_MultiAge_PAT24B3: { asset_id: "W_MultiAge_PAT24B3", name: "Gala Cow Barn" },
    },
  }

  it("reads the buildings, without streets", () => {
    const city = parseFoeHelperExport(exported, "fr12_citymap_261021-1530_123456.json")
    expect(city.world).toBe("fr12")
    expect(city.playerId).toBe(123456)
    expect(city.era).toBe("SpaceAgeTitan")
    expect(city.entities).toEqual([
      {
        id: "H_SpaceAgeTitan_Townhall",
        assetId: "H_SpaceAgeTitan_Townhall",
        name: "Town Hall",
        type: "main_building",
        x: 8,
        y: 17,
        connected: true,
        era: "SpaceAgeTitan",
      },
      {
        id: "W_MultiAge_PAT24B3",
        assetId: "W_MultiAge_PAT24B3",
        name: "Gala Cow Barn",
        type: "generic_building",
        x: 3,
        y: 4,
        connected: false,
      },
    ])
  })

  it("gives buildings their own age", () => {
    const city = parseFoeHelperExport({
      CityMapData: {
        "1": { cityentity_id: "W_MultiAge_SUM25A13", type: "generic_building", level: 5 },
        "2": { cityentity_id: "R_IronAge_Barracks", type: "military" },
        "3": { cityentity_id: "W_AllAge_Decoration", type: "decoration" },
      },
    })
    expect(city.entities.map((entity) => entity.era)).toEqual([
      "LateMiddleAge",
      "IronAge",
      undefined,
    ])
  })

  it("rates each building at its own age, the player's otherwise", () => {
    const iron = building("a", 10)
    const titan = building("a", 50)
    const { rows } = rateCity(
      {
        ...city(["W_A", "W_A"]),
        era: "SpaceAgeTitan",
        entities: [
          { id: "W_A", x: 0, y: 0, connected: true, era: "IronAge" },
          { id: "W_A", x: 1, y: 0, connected: true },
        ],
      },
      { buildings: { W_A: "a" }, greatBuildings: {} },
      { IronAge: [iron], SpaceAgeTitan: [titan] },
      {},
      "SpaceAgeTitan",
      ["fp"],
    )
    expect(rows.map((row) => [row.age, row.count])).toEqual([
      ["IronAge", 1],
      ["SpaceAgeTitan", 1],
    ])
  })

  it("refuses other JSON", () => {
    expect(() => parseFoeHelperExport({ hello: 1 })).toThrow(FoeHelperFormatError)
  })
})

describe("Great Buildings in the city", () => {
  const arc = {
    id: "the_arc",
    name: { fr: "L'Arche", en: "The Arc" },
    image: "https://foeen.innogamescdn.com/assets/city/buildings/X_SS_FutureEra_Landmark1-abc.png",
    size: { w: 7, h: 5 },
    road: "road",
    levels: {
      columns: [
        { label: { fr: "Ressources de la guilde", en: "Guild Goods" } },
        { label: { fr: "Bonus de contribution", en: "Contribution Boost" } },
      ],
      rows: [
        { level: 1, values: ["10", "20%"] },
        { level: 80, values: ["120", "90%"] },
      ],
    },
  } as unknown as GreatBuilding

  it("count their production bonuses in the score, at their level", () => {
    expect(greatBuildingStats(arc, 80)).toEqual({ guild_goods: 120 })
  })

  it("are rated at their level, by the game id of their picture", () => {
    const { rows } = rateCity(
      {
        world: "fr12",
        playerId: 1,
        entities: [{ id: "X_FutureEra_Landmark1", x: 0, y: 0, connected: true, level: 80 }],
      },
      { buildings: {}, greatBuildings: { X_FutureEra_Landmark1: "the_arc" } },
      {},
      { the_arc: arc },
      "SpaceAgeTitan",
      ["guild_goods"],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: "great_building", id: "the_arc", level: 80, count: 1 })
    expect(rows[0].score).toBeGreaterThan(0)
  })
})
