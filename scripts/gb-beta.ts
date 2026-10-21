// Great Buildings of the beta server (prestige rework) from the game's own data: the
// per-building metadata the client downloads, taken from a network capture cleaned by
// scripts/har-extract.ts. Writes data/gb-beta.json (milestone values, see src/core/gb-beta.ts).
//   pnpm har-extract ~/Downloads/beta.har beta   (then delete the .har)
//   pnpm gb-beta [beta]

import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import {
  BetaGreatBuildingSchema,
  COPPER_MAX_LEVEL,
  GOLD_MAX_LEVEL,
  type BetaColumn,
  type BetaGreatBuilding,
} from "../src/core/gb-beta"

// Values that are amounts, not percentages
const AMOUNTS = new Set([
  "happiness",
  "population",
  "aid_goods",
  "plunder_goods",
  "military_ally_boost",
  "science_ally_boost",
])

type GameValue = { value?: number; amount?: number }
type GameBonus = {
  type: string
  targetedFeature?: string
  bonusCategory: { value: string }
  valuesMap: Record<string, GameValue>
}
type GameGreatBuilding = {
  __class__: string
  id: string
  name: string
  maxTier: { value: "copper" | "gold" }
  strategy_points_for_upgrade: number[]
  bonuses: { tier: { value: "copper" | "gold" }; bonuses: GameBonus[] }[]
}

const normalize = (name: string) =>
  name
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z]/g, "")

function column(tier: "copper" | "gold", bonus: GameBonus): BetaColumn {
  const milestones = Object.entries(bonus.valuesMap)
    .map(([level, { value = 0, amount }]) => ({
      level: Number(level),
      value,
      // -1: no count for this bonus
      ...(amount !== undefined && amount >= 0 && { count: amount }),
    }))
    .sort((a, b) => a.level - b.level)
  return {
    bonus: bonus.type,
    context: bonus.targetedFeature ?? "all",
    tier,
    percent: bonus.bonusCategory.value !== "productionBonus" && !AMOUNTS.has(bonus.type),
    milestones,
  }
}

function main() {
  const capture = `scripts/.cache/har/${process.argv[2] ?? "beta"}`
  const ours = new Map(
    readdirSync("data/great-buildings")
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(`data/great-buildings/${file}`, "utf8")))
      .map((gb: { id: string; name: { en: string } }) => [normalize(gb.name.en), gb.id]),
  )

  const buildings: Record<string, BetaGreatBuilding> = {}
  for (const file of readdirSync(capture).filter((f) => f.includes("metadata"))) {
    const text = readFileSync(`${capture}/${file}`, "utf8")
    if (!text.includes('"CityEntityGreatBuilding"')) continue
    const json = JSON.parse(text)
    for (const gb of (Array.isArray(json) ? json : [json]) as GameGreatBuilding[]) {
      if (gb.__class__ !== "CityEntityGreatBuilding") continue
      const id = ours.get(normalize(gb.name))
      if (!id) {
        console.log(
          `${gb.name} (${gb.id}): no Great Building with that name in data/great-buildings`,
        )
        continue
      }
      buildings[id] = BetaGreatBuildingSchema.parse({
        maxLevel: gb.maxTier.value === "gold" ? GOLD_MAX_LEVEL : COPPER_MAX_LEVEL,
        firstLevelCost: gb.strategy_points_for_upgrade[0],
        columns: gb.bonuses.flatMap((tier) => tier.bonuses.map((b) => column(tier.tier.value, b))),
      })
    }
  }
  const gold = Object.values(buildings).filter((gb) => gb.maxLevel > COPPER_MAX_LEVEL).length
  const count = Object.keys(buildings).length
  if (!count)
    throw new Error(`No Great Building in ${capture}: was the city loaded in the capture?`)
  console.log(`${count} Great Buildings (${gold} with the Gold tier) from ${capture}`)
  writeFileSync(
    "data/gb-beta.json",
    JSON.stringify({ source: "beta server", extractedAt: new Date().toISOString(), buildings }) +
      "\n",
  )
}

main()
