import { describe, expect, it } from "vitest"
import {
  BuildingSchema,
  DEFAULT_REFERENCES,
  STAT_KEYS,
  isScorable,
  roadShare,
  score,
  tileCount,
  type StatKey,
} from "@/core"

const ALL_SCORABLE = STAT_KEYS.filter((key) => isScorable(key))

describe("roadShare", () => {
  it.each([
    [{ w: 1, h: 1 }, "road", 0.5],
    [{ w: 4, h: 4 }, "road", 2],
    [{ w: 3, h: 4 }, "road", 1.5],
    [{ w: 5, h: 6 }, "road", 2.5],
    [{ w: 6, h: 10 }, "two_lane", 6],
    [{ w: 6, h: 6 }, "none", 0],
  ] as const)("%o with %s -> %d", (size, road, expected) => {
    expect(roadShare(size, road)).toBe(expected)
  })

  it("adds the road share to the tile count", () => {
    expect(tileCount({ w: 4, h: 4 }, "road")).toBe(18)
  })
})

// Expected scores come from the reference spreadsheet ("Rentabilité" column)
describe("score matches the reference spreadsheet", () => {
  it.each<[string, number, Partial<Record<StatKey, number>>, number]>([
    [
      "Marché éternel - Horizon toscan",
      36,
      { fp: 252, goods_prev: 360, atk_army_att_classic: 198, def_army_att_classic: 198 },
      2.45,
    ],
    [
      "Marché éternel - Horizon noble (Niv. 2)",
      36,
      {
        fp: 288,
        goods_prev: 390,
        goods: 390,
        atk_army_att_classic: 200,
        atk_army_att_qi: 5,
        atk_army_def_qi: 5,
        def_army_att_classic: 200,
        def_army_att_qi: 5,
        def_army_def_qi: 5,
      },
      3.761689815,
    ],
    ["Pagode - Niv. 6", 18, { fp: 2, goods: 10 }, 0.06666666667],
    [
      "EverGreen Express - Niv. 1",
      15,
      { fp: 75, goods: 75, atk_army_att_gbg: 90, atk_army_def_gbg: 105, def_army_def_qi: 15 },
      1.879166667,
    ],
    ["Finish Special Production reference", 39, { fsp: 30 }, 15.38461538],
  ])("%s", (_name, tiles, stats, expected) => {
    expect(score(stats, tiles, ALL_SCORABLE)).toBeCloseTo(expected, 6)
  })
})

describe("score", () => {
  it("converts percent boosts into the boosted stat", () => {
    // 3% FP boost = 600 FP, 1% goods boost = 300 goods
    const stats = { fp: 100, fp_boost: 3, goods: 250, goods_boost: 1 }
    expect(score(stats, 30, ["fp", "fp_boost", "goods", "goods_boost"])).toBeCloseTo(
      (100 / 30 + 600 / 30) / 10 + (250 / 30 + 300 / 30) / 10,
    )
  })

  it("only counts selected stats", () => {
    expect(score({ fp: 100, goods: 100 }, 10, ["fp"])).toBeCloseTo(1)
  })

  it("ignores stats without a reference", () => {
    expect(isScorable("population")).toBe(false)
    expect(score({ population: 1000 }, 10, ["population"])).toBe(0)
  })

  it("uses custom references", () => {
    expect(score({ fp: 100 }, 10, ["fp"], { ...DEFAULT_REFERENCES, fp: 5 })).toBeCloseTo(2)
  })
})

describe("BuildingSchema", () => {
  const terraceFarm = {
    id: "P_SS_MultiAge_Expedition16",
    name: { fr: "Ferme en terrasses", en: "Terrace Farm" },
    type: "special",
    chain: { id: "terrace_farm", level: 1 },
    size: { w: 5, h: 6 },
    road: "road",
    reliability: "official",
    stats: {
      BronzeAge: { fp: 5, goods: 10, supplies: 260, medals: 9, population: -140 },
      IronAge: { fp: 5, goods: 10, supplies: 610, medals: 11, population: -270 },
    },
  }

  it("accepts a valid building", () => {
    expect(BuildingSchema.safeParse(terraceFarm).success).toBe(true)
  })

  it("rejects an unknown stat", () => {
    const invalid = { ...terraceFarm, stats: { BronzeAge: { forge_points: 5 } } }
    expect(BuildingSchema.safeParse(invalid).success).toBe(false)
  })

  it("rejects an unknown age", () => {
    const invalid = { ...terraceFarm, stats: { StoneAge: { fp: 5 } } }
    expect(BuildingSchema.safeParse(invalid).success).toBe(false)
  })
})
