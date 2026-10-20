import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
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

  it("reads asset id, image, size, road and event", () => {
    expect(building).toMatchObject({
      assetId: "P_SS_MultiAge_Expedition16",
      image:
        "https://foeen.innogamescdn.com/assets/city/buildings/P_SS_MultiAge_Expedition16-cf9a5a730.png",
      size: { w: 5, h: 6 },
      road: "road",
      event: "Events and Questlines",
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
          rewards: [{ type: "stat", stat: "goods_prev", amount: 360 }],
        },
      ])
    }
    expect(building?.ages.IronAge?.passive.population).toBe(2580)
  })

  it("reports productions that are not daily", () => {
    expect(issues).toContainEqual({ kind: "non_daily_production", detail: "10h Production" })
  })
})
