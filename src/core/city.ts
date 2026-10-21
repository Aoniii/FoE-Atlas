// A player's main city, read from a FoE Helper export, and how profitable each of its
// buildings is: at the building's own age, Great Buildings at their level.

import { AGES, type AgeId } from "./ages"
import type { AgeBuilding, StatBlock } from "./building"
import { aggregateStats, score, tileCount, type References } from "./efficiency"
import type { GreatBuilding } from "./great-building"
import type { StatKey } from "./stats"

export type CityEntity = {
  // Game ids: "W_MultiAge_HERO24H1"; assetId names the picture (often the same)
  id: string
  assetId?: string
  name?: string
  type?: string
  x: number
  y: number
  connected: boolean
  // The building's own age when it has one (event buildings keep the age they were built or
  // upgraded in); undefined: it follows the player's age
  era?: string
  // Great Building level
  level?: number
}

export type City = {
  // Game server: "fr12", "zz1" (beta)...
  world: string
  playerId: number
  playerName?: string
  cityName?: string
  // Player's age, game id ("SpaceAgeTitan")
  era?: string
  updatedAt?: string
  // Order of import on the City tab: "City #2"
  number?: number
  entities: CityEntity[]
}

export type CityAssets = {
  buildings: Record<string, string>
  greatBuildings: Record<string, string>
}

// One line of the rated city: a building at an age, or a Great Building at a level
export type CityRow = {
  kind: "building" | "great_building"
  id: string
  name: { fr: string; en: string }
  image?: string
  // Age of a building, of the player for a Great Building
  age: AgeId
  // Great Building level
  level?: number
  count: number
  tiles: number
  stats: StatBlock
  score: number
}

export type RatedCity = {
  rows: CityRow[]
  // Buildings FoE Atlas does not know (main building, culture...): by name
  unknown: { name: string; count: number }[]
}

const isAge = (era: string | undefined): era is AgeId => AGES.some((age) => age.id === era)

// Age each building of the city is rated at: its own, else the player's
export function entityAge(city: City, entity: CityEntity, fallback: AgeId): AgeId {
  if (isAge(entity.era)) return entity.era
  return isAge(city.era) ? city.era : fallback
}

// Great Building of a city entity, if it is one
export function greatBuildingId(entity: CityEntity, assets: CityAssets): string | undefined {
  return assets.greatBuildings[entity.assetId ?? entity.id] ?? assets.greatBuildings[entity.id]
}

const number = (value: string | undefined) => {
  const match = value?.match(/^([\d,]+(?:\.\d+)?)\s*%?$/)
  return match ? Number(match[1].replace(/,/g, "")) : 0
}
const ARMY = {
  attackers: ["atk_army_att_classic", "atk_army_def_classic"],
  defenders: ["def_army_att_classic", "def_army_def_classic"],
} as const
// Great Building bonuses counted in the score, by the wiki's column name; the others
// (contribution boost, first strike, plunder repel...) are not stats of the score
const GB_STATS: Record<string, readonly StatKey[]> = {
  Research: ["fp"],
  "Guild Goods": ["guild_goods"],
  "Good production": ["goods"],
  "Previous Era Goods Production": ["goods_prev"],
  "Coin production": ["coins"],
  "Supply production": ["supplies"],
  "Medal production": ["medals"],
  Happiness: ["happiness"],
  Population: ["population"],
  "Attackers - Attack & Defense": ARMY.attackers,
  "Defenders - Attack & Defense": ARMY.defenders,
  "Attackers & Defenders - Attack & Defense": [...ARMY.attackers, ...ARMY.defenders],
}

// Stats of a Great Building at a level (its level table, extended past the wiki)
export function greatBuildingStats(gb: GreatBuilding, level: number): StatBlock {
  const row = gb.levels.rows.find((r) => r.level === level) ?? gb.levels.rows.at(-1)
  const stats: StatBlock = {}
  gb.levels.columns.forEach((column, index) => {
    for (const key of GB_STATS[column.label.en] ?? []) {
      stats[key] = (stats[key] ?? 0) + number(row?.values[index])
    }
  })
  return stats
}

// Buildings of the city found in the wiki, at their own age, and Great Buildings at their
// level: one row per building and age (or Great Building and level) with its count; the
// others listed apart. `buildingsByAge`: the wiki's buildings of each age the city needs
// (see entityAge); `greatBuildings`: those of the city (see greatBuildingId).
export function rateCity(
  city: City,
  assets: CityAssets,
  buildingsByAge: Partial<Record<AgeId, AgeBuilding[]>>,
  greatBuildings: Record<string, GreatBuilding>,
  fallback: AgeId,
  scoreKeys: StatKey[],
  references?: References,
): RatedCity {
  const lookup = new Map<AgeId, Map<string, AgeBuilding>>()
  const find = (age: AgeId, id: string) => {
    if (!lookup.has(age))
      lookup.set(age, new Map((buildingsByAge[age] ?? []).map((b) => [b.id, b])))
    return lookup.get(age)!.get(id)
  }
  const rows = new Map<string, CityRow>()
  const add = (key: string, row: Omit<CityRow, "count" | "score">) => {
    const count = (rows.get(key)?.count ?? 0) + 1
    rows.set(key, { ...row, count, score: score(row.stats, row.tiles, scoreKeys, references) })
  }
  const unknown = new Map<string, number>()
  for (const entity of city.entities) {
    const age = entityAge(city, entity, fallback)
    const gb = greatBuildings[greatBuildingId(entity, assets) ?? ""]
    if (gb && entity.level) {
      const { id, name, image, size, road } = gb
      const stats = greatBuildingStats(gb, entity.level)
      const tiles = tileCount(size, road)
      add(`gb:${id}@${entity.level}`, {
        kind: "great_building",
        id,
        name,
        image,
        age,
        level: entity.level,
        tiles,
        stats,
      })
      continue
    }
    const id = assets.buildings[entity.assetId ?? entity.id] ?? assets.buildings[entity.id]
    const building = id ? find(age, id) : undefined
    if (building) {
      const { name, image, size, road } = building
      const stats = aggregateStats(building.age)
      add(`${building.id}@${age}`, {
        kind: "building",
        id: building.id,
        name,
        image,
        age,
        tiles: tileCount(size, road),
        stats,
      })
    } else {
      const name = entity.name ?? entity.id
      unknown.set(name, (unknown.get(name) ?? 0) + 1)
    }
  }
  return {
    rows: [...rows.values()],
    unknown: [...unknown]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  }
}

// "fr12" -> "FR 12", "zz1" -> "Beta"
export function worldLabel(world: string): string {
  if (/^zz\d*$/.test(world)) return "Beta"
  const match = world.match(/^([a-z]+)(\d+)$/)
  return match ? `${match[1].toUpperCase()} ${match[2]}` : world
}

// FoE Helper's city map export (City map > Download / Copy):
// { CityMapData: { [entityId]: game entity }, CityEntities: { [cityentity_id]: definition } }.
// Its file name gives the server and the player: "fr12_citymap_261021-1530_123456.json".
type FoeHelperEntity = {
  cityentity_id?: string
  type?: string
  x?: number
  y?: number
  connected?: number
  // Multi-age buildings: their age, game era id minus 1 (1 = Bronze Age); Great
  // Buildings: their level
  level?: number
}

// Same rule as FoE Helper (CityMap.GetBuildingEra): multi-age buildings by their level,
// others by the age in their id ("R_BronzeAge_Barracks"); AllAge ones follow the player
function ownAge(entity: FoeHelperEntity): AgeId | undefined {
  const id = entity.cityentity_id ?? ""
  if (entity.type === "greatbuilding" || id.includes("AllAge")) return undefined
  if (entity.level) return AGES[entity.level - 1]?.id
  const age = id.split("_")[1]
  return isAge(age) ? age : undefined
}
type FoeHelperDefinition = { asset_id?: string; name?: string }

export class FoeHelperFormatError extends Error {}

export function parseFoeHelperExport(json: unknown, fileName?: string): City {
  const data = json as { CityMapData?: unknown; CityEntities?: Record<string, FoeHelperDefinition> }
  if (!data?.CityMapData || typeof data.CityMapData !== "object") {
    throw new FoeHelperFormatError("Not a FoE Helper city map export")
  }
  const raw = Object.values(data.CityMapData as Record<string, FoeHelperEntity>)
  const definitions = data.CityEntities ?? {}
  const file = fileName?.match(/^([a-z]+\d+)_citymap_[\d-]+_(\d+)\.json$/i)
  // The export has no player age: the town hall's id carries it ("H_SpaceAgeTitan_Townhall")
  const townHall = raw.find((entity) => entity.type === "main_building")?.cityentity_id
  return {
    world: file?.[1].toLowerCase() ?? "foe-helper",
    playerId: Number(file?.[2] ?? 0),
    era: townHall?.match(/^H_([A-Za-z]+)_/)?.[1],
    updatedAt: new Date().toISOString(),
    entities: raw
      .filter((entity) => entity.cityentity_id && entity.type !== "street")
      .map((entity) => {
        const definition = definitions[entity.cityentity_id!] ?? {}
        return {
          id: entity.cityentity_id!,
          ...(definition.asset_id && { assetId: definition.asset_id }),
          ...(definition.name && { name: definition.name }),
          type: entity.type,
          x: entity.x ?? 0,
          y: entity.y ?? 0,
          connected: entity.connected === 1,
          ...(ownAge(entity) && { era: ownAge(entity) }),
          ...(entity.type === "greatbuilding" && entity.level && { level: entity.level }),
        }
      }),
  }
}
