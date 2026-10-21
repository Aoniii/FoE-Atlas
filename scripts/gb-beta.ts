// Great Buildings of the beta server (prestige rework) from the game's own data: the
// per-building metadata the client downloads, taken from a network capture cleaned by
// scripts/har-extract.ts. Writes data/gb-beta.json (milestone values, see src/core/gb-beta.ts).
//   pnpm har-extract ~/Downloads/beta.har beta   (then delete the .har)
//   pnpm gb-beta [beta]

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { PNG } from "pngjs"
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

const ICONS = "public/beta-icons"
// Icon names in the game's sheet: icon_great_building_bonus_<name>
const ICON_NAMES: Record<string, string> = {
  aid_boost: "aid_blueprints",
  clan_goods: "guild_goods",
  clan_goods_extended: "guild_goods_adjacent_era",
  double_collection: "double_collect",
  happiness: "happy",
  money: "coins",
  money_boost: "coins",
  previous_era_goods: "previous_era_good_production",
  quest_boost: "scroll",
  random_goods: "goods",
  strategy_points: "forgepoints",
  supplies_boost: "supplies",
  totem_drop: "relic_hunt",
}
const CONTEXT_ICONS: Record<string, string> = {
  battleground: "_gbg",
  guild_expedition: "_gex",
  guild_raids: "_gr",
}
// Army bonuses: which army, which value
const ARMY_ICONS: Record<string, string> = {
  military_boost: "attacking_all",
  fierce_resistance: "defending_all",
  advanced_tactics: "attacking_defending_all",
  attack_boost: "attacking_attack",
  attacker_defense_boost: "attacking_defense",
  defender_attack_boost: "defending_attack",
  defense_boost: "defending_defense",
}
const MULTIPLIED = new Set([
  "attack_boost",
  "attacker_defense_boost",
  "defender_attack_boost",
  "defense_boost",
])

function iconName(bonus: string, context: string): string {
  const army = ARMY_ICONS[bonus]
  if (!army) return ICON_NAMES[bonus] ?? bonus
  const multiplier = MULTIPLIED.has(bonus) || context !== "all" ? "_multiplier" : ""
  // Alcatraz's GBG attack and defense for both armies is the only plain one with a context
  const plain = bonus === "advanced_tactics" && context !== "all"
  return `${army}${CONTEXT_ICONS[context] ?? ""}${plain ? "" : multiplier}`
}

// [name, x, y, width, height, offset x, offset y, source width, source height, rotated]
type Frame = [string, number, number, number, number, ...unknown[]]

// Cuts the icons out of the game's sheet (downloaded from the game's public image server)
// into public/beta-icons/<name>.png
async function writeIcons(capture: string, names: Set<string>): Promise<Set<string>> {
  const sheetJson = readdirSync(capture).find((f) =>
    /assets_shared_icons_icons_0-.*\.json$/.test(f),
  )
  const sheetUrl = (
    JSON.parse(readFileSync(`${capture}/icon-sheets.json`, "utf8")) as string[]
  ).find((url) => /\/shared\/icons\/icons_0-[^/]+\.png$/.test(url))
  if (!sheetJson || !sheetUrl) throw new Error(`No icon sheet in ${capture}: run pnpm har-extract`)
  const frames = new Map(
    (JSON.parse(readFileSync(`${capture}/${sheetJson}`, "utf8")).frames as Frame[]).map((f) => [
      f[0],
      f,
    ]),
  )
  const response = await fetch(sheetUrl)
  if (!response.ok) throw new Error(`${sheetUrl}: HTTP ${response.status}`)
  const sheet = PNG.sync.read(Buffer.from(await response.arrayBuffer()))
  rmSync(ICONS, { recursive: true, force: true })
  mkdirSync(ICONS, { recursive: true })
  const written = new Set<string>()
  for (const name of names) {
    const frame = frames.get(`icon_great_building_bonus_${name}`)
    if (!frame) {
      console.log(`No icon for ${name}`)
      continue
    }
    const [, x, y, width, height] = frame
    const rotated = frame[9] === true
    // A rotated frame is stored a quarter turn clockwise: read it back counterclockwise
    const icon = new PNG({ width, height })
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const [sx, sy] = rotated ? [x + (height - 1 - row), y + col] : [x + col, y + row]
        const from = (sy * sheet.width + sx) * 4
        const to = (row * width + col) * 4
        sheet.data.copy(icon.data, to, from, from + 4)
      }
    }
    writeFileSync(`${ICONS}/${name}.png`, PNG.sync.write(icon))
    written.add(name)
  }
  return written
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

async function main() {
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
  const columns = Object.values(buildings).flatMap((gb) => gb.columns)
  const icons = await writeIcons(capture, new Set(columns.map((c) => iconName(c.bonus, c.context))))
  for (const c of columns) {
    const name = iconName(c.bonus, c.context)
    if (icons.has(name)) c.icon = `${name}.png`
  }
  console.log(`${icons.size} icons in ${ICONS}`)
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

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
