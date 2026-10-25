import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { buildChains, slug } from "../scripts/scrape/chains"
import { eventFromAsset } from "../scripts/scrape/events"
import { iconKey, isBuildingPage, parseBuildingPage } from "../scripts/scrape/parse"

// Trimmed copy of the official wiki page structure (values shortened)
const wikitext = readFileSync(new URL("./fixtures/terrace-farm.wikitext", import.meta.url), "utf8")

describe("scraper parser", () => {
  const { building, issues } = parseBuildingPage(wikitext)

  it("detects building pages", () => {
    expect(isBuildingPage(wikitext)).toBe(true)
    expect(isBuildingPage("Just a help page")).toBe(false)
  })

  it("strips the hash from icon file names", () => {
    expect(iconKey("https://x/icons/reward_icons/reward_icon_one_up_kit-395ac8f66.png")).toBe(
      "reward_icon_one_up_kit",
    )
  })

  it("reads asset id, image, size and road", () => {
    expect(building).toMatchObject({
      assetId: "P_SS_MultiAge_Expedition16",
      image:
        "https://foeen.innogamescdn.com/assets/city/buildings/P_SS_MultiAge_Expedition16-cf9a5a730.png",
      // "5x6" on the wiki: the game's width comes second
      size: { w: 6, h: 5 },
      road: "road",
    })
  })

  it("reads boosts, demands and happiness as passive values", () => {
    expect(building?.ages.BronzeAge?.passive).toEqual({
      atk_army_att_gbg: 1,
      atk_army_def_gbg: 1,
      population: -140,
      happiness: -110,
    })
  })

  it("keeps the 1d production with motivated and random outputs", () => {
    const icon = (name: string) =>
      `https://foeen.innogamescdn.com/assets/shared/icons/${name}-1a2b3c4d5.png`
    expect(building?.ages.BronzeAge?.production).toEqual([
      {
        kind: "guaranteed",
        rewards: [
          { type: "stat", stat: "goods", amount: 10 },
          { type: "stat", stat: "fp", amount: 5 },
          {
            type: "item",
            id: "reward_icon_mystery_kit",
            name: { fr: "Mystery Kit", en: "Mystery Kit" },
            amount: 2,
            icon: icon("reward_icons/reward_icon_mystery_kit"),
          },
        ],
      },
      {
        kind: "guaranteed",
        motivated: true,
        rewards: [{ type: "stat", stat: "goods_prev", amount: 3 }],
      },
      {
        kind: "random",
        motivated: true,
        options: [
          { chance: 50, rewards: [{ type: "stat", stat: "fp", amount: 4 }] },
          {
            chance: 50,
            rewards: [
              {
                type: "item",
                id: "blueprint",
                name: { fr: "Blueprints", en: "Blueprints" },
                amount: 2,
                icon: icon("blueprint"),
              },
            ],
          },
        ],
      },
    ])
  })

  it("parses thousands separators", () => {
    expect(building?.ages.IronAge?.passive.population).toBe(-1270)
  })

  it("reports unknown icons", () => {
    expect(issues).toContainEqual({ kind: "unknown_icon", detail: "reward_icon_mystery_kit" })
  })
})

describe("scraper parser, age-independent properties", () => {
  const wikitext = readFileSync(
    new URL("./fixtures/eternal-market.wikitext", import.meta.url),
    "utf8",
  )
  const { building, issues } = parseBuildingPage(wikitext)

  it("reads the road from a 'Street' property", () => {
    expect(building?.road).toBe("two_lane")
  })

  it("adds constant boosts and 1d production to every age", () => {
    for (const age of ["BronzeAge", "IronAge"] as const) {
      expect(building?.ages[age]?.passive).toMatchObject({
        atk_army_att_classic: 198,
        def_army_att_classic: 198,
      })
      expect(building?.ages[age]?.production).toEqual([
        { kind: "guaranteed", rewards: [{ type: "stat", stat: "fp", amount: 252 }] },
        {
          kind: "guaranteed",
          motivated: true,
          rewards: [
            { type: "stat", stat: "goods_prev", amount: 360 },
            { type: "stat", stat: "guild_goods", amount: 7200 },
          ],
        },
      ])
    }
    expect(building?.ages.IronAge?.passive.population).toBe(2580)
  })

  it("reports productions that are not daily", () => {
    expect(issues).toContainEqual({ kind: "non_daily_production", detail: "10h Production" })
  })
})

describe("event from asset id", () => {
  it.each([
    ["W_SS_MultiAge_WIN25A2", { event: "winter", year: 2025 }],
    ["W_SS_MultiAge_FALL24D1", { event: "fall", year: 2024 }],
    ["W_SS_MultiAge_COP24E7TEMP", { event: "cultural_settlements", year: 2024 }],
    ["R_SS_MultiAge_SummerBonus21b", { event: "summer", year: 2021 }],
    ["W_SS_MultiAge_HalloweenBonusGP22g", { event: "halloween", year: 2022 }],
    ["W_SS_MultiAge_GBGWatchtower2023B", { event: "gbg", year: 2023 }],
    ["P_SS_MultiAge_Expedition16", { event: "guild_expeditions", year: 2016 }],
    ["R_SS_MultiAge_CulturalBuilding7i", { event: "cultural_settlements" }],
    ["W_SS_MultiAge_Anw23A1", { event: "old", year: 2023 }],
    ["D_SS_MultiAge_SpringBonusSet18a", { event: "spring", year: 2018 }],
    ["R_SS_MultiAge_EasterBonus4", { event: "easter" }],
  ])("%s", (assetId, expected) => {
    expect(eventFromAsset(assetId)).toEqual(expected)
  })

  it("ignores ids that are not special buildings", () => {
    expect(eventFromAsset("R_BronzeAge_Hut1")).toBeUndefined()
  })
})

describe("upgrade chains", () => {
  const node = (title: string, upgradesTo: string[] = []) => ({
    id: slug(title),
    title,
    upgradesTo,
  })

  it("follows kit upgrades after the numbered levels", () => {
    const chains = buildChains([
      node("Whisperwood Watermill - Lv. 1", ["Whisperwood Watermill - Lv. 2"]),
      node("Whisperwood Watermill - Lv. 2", ["Sylvan Whisperwood Watermill"]),
      node("Sylvan Whisperwood Watermill", ["Arcadian Whisperwood Watermill"]),
      node("Arcadian Whisperwood Watermill"),
      node("Unrelated Building"),
    ])
    expect(chains.get("arcadian_whisperwood_watermill")).toEqual({
      id: "whisperwood_watermill",
      level: 4,
    })
    expect(chains.get("whisperwood_watermill_lv_1")?.level).toBe(1)
    expect(chains.has("unrelated_building")).toBe(false)
  })

  it("links numbered titles when the wiki misses a link", () => {
    const chains = buildChains([node("Terrace Farm"), node("Terrace Farm - Lv. 2")])
    expect(chains.get("terrace_farm_lv_2")).toEqual({ id: "terrace_farm", level: 2 })
  })

  it("gives variants of the same step the same level", () => {
    const chains = buildChains([
      node("Resort - Lv. 1", ["Resort with Garden", "Resort for Couples"]),
      node("Resort with Garden"),
      node("Resort for Couples"),
    ])
    expect(chains.get("resort_with_garden")?.level).toBe(2)
    expect(chains.get("resort_for_couples")?.level).toBe(2)
  })
})
