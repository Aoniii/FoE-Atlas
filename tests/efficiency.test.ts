import { describe, expect, it } from "vitest"
import {
  BuildingSchema,
  DEFAULT_REFERENCES,
  aggregateStats,
  STAT_KEYS,
  isScorable,
  roadShare,
  score,
  tileCount,
  type StatKey,
} from "@/core"

const ALL_SCORABLE = STAT_KEYS.filter((key) => isScorable(key))

// References of the reference spreadsheet: the formula must reproduce its scores
// whatever our own tuned references are
// The spreadsheet's boost values: +1% FP = 200 FP, goods 300, guild goods 450
const SHEET_BASES = { fp: 20000, goods: 30000, guild_goods: 45000 }

const SHEET_REFERENCES = {
  fp: 10,
  goods_prev: 12,
  goods: 10,
  goods_next: 10,
  special_goods: 50,
  guild_goods: 15,
  atk_army_att_classic: 12,
  atk_army_def_classic: 12,
  atk_army_att_gbg: 15,
  atk_army_def_gbg: 15,
  atk_army_att_ge: 100,
  atk_army_def_ge: 100,
  atk_army_att_qi: 5,
  atk_army_def_qi: 8,
  def_army_att_classic: 12,
  def_army_def_classic: 12,
  def_army_att_gbg: 15,
  def_army_def_gbg: 15,
  def_army_att_ge: 100,
  def_army_def_ge: 100,
  def_army_att_qi: 50,
  def_army_def_qi: 80,
  units: 15,
  fsp: 0.05,
}

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
    expect(score(stats, tiles, ALL_SCORABLE, SHEET_REFERENCES, SHEET_BASES)).toBeCloseTo(
      expected,
      6,
    )
  })
})

describe("score", () => {
  it("converts percent boosts into a share of the player's production", () => {
    // 3% of 2,000 FP = 60 FP, 1% of 1,500 goods = 15 goods
    const stats = { fp: 100, fp_boost: 3, goods: 250, goods_boost: 1 }
    expect(score(stats, 30, ["fp", "fp_boost", "goods", "goods_boost"])).toBeCloseTo(
      (100 / 30 + 60 / 30) / 10 + (250 / 30 + 15 / 30) / 10,
    )
  })

  it("follows the production bases given", () => {
    const bases = { fp: 10000, goods: 0, guild_goods: 0 }
    expect(score({ fp_boost: 1 }, 10, ["fp_boost"], undefined, bases)).toBeCloseTo(1)
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

describe("aggregateStats", () => {
  const age = {
    passive: {},
    production: [
      {
        kind: "guaranteed" as const,
        rewards: [{ type: "stat" as const, stat: "fp" as const, amount: 5 }],
      },
      {
        kind: "guaranteed" as const,
        motivated: true,
        rewards: [{ type: "stat" as const, stat: "fp" as const, amount: 3 }],
      },
    ],
  }

  it("counts motivated production by default", () => {
    expect(aggregateStats(age)).toEqual({ fp: 8 })
  })

  it("can ignore motivated production", () => {
    expect(aggregateStats(age, { motivated: false })).toEqual({ fp: 5 })
  })
})

describe("BuildingSchema", () => {
  const terraceFarm = {
    id: "terrace_farm",
    name: { fr: "Ferme en terrasses", en: "Terrace Farm" },
    type: "special",
    chain: { id: "terrace_farm", level: 1 },
    size: { w: 5, h: 6 },
    road: "road",
    image: "https://foeen.innogamescdn.com/assets/city/buildings/P_SS_MultiAge_Expedition16.png",
    reliability: "official",
    ages: {
      BronzeAge: {
        passive: { population: -140 },
        production: [
          {
            kind: "guaranteed",
            rewards: [
              { type: "stat", stat: "fp", amount: 5 },
              { type: "stat", stat: "goods", amount: 10 },
            ],
          },
          {
            kind: "random",
            options: [
              {
                chance: 20,
                rewards: [
                  {
                    type: "item",
                    id: "renovation_kit",
                    name: { fr: "Kit de rénovation", en: "Renovation Kit" },
                    amount: 1,
                  },
                ],
              },
              { chance: 80, rewards: [{ type: "stat", stat: "medals", amount: 9 }] },
            ],
          },
        ],
      },
    },
  }

  it("accepts a valid building", () => {
    expect(BuildingSchema.safeParse(terraceFarm).success).toBe(true)
  })

  it("rejects an unknown stat", () => {
    const invalid = {
      ...terraceFarm,
      ages: { BronzeAge: { passive: { forge_points: 5 }, production: [] } },
    }
    expect(BuildingSchema.safeParse(invalid).success).toBe(false)
  })

  it("rejects an unknown age", () => {
    const invalid = { ...terraceFarm, ages: { StoneAge: { passive: {}, production: [] } } }
    expect(BuildingSchema.safeParse(invalid).success).toBe(false)
  })

  it("rejects random chances above 100%", () => {
    const reward = { type: "stat", stat: "fp", amount: 1 }
    const invalid = {
      ...terraceFarm,
      ages: {
        BronzeAge: {
          passive: {},
          production: [
            {
              kind: "random",
              options: [
                { chance: 60, rewards: [reward] },
                { chance: 60, rewards: [reward] },
              ],
            },
          ],
        },
      },
    }
    expect(BuildingSchema.safeParse(invalid).success).toBe(false)
  })

  it("aggregates guaranteed and expected random rewards", () => {
    const building = BuildingSchema.parse(terraceFarm)
    expect(aggregateStats(building.ages.BronzeAge!)).toEqual({
      population: -140,
      fp: 5,
      goods: 10,
      medals: 9 * 0.8,
    })
  })
})
