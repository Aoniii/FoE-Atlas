// A player's main city, read from a FoE Helper export, and how profitable each of its
// buildings is, at the building's own age.

import { AGES, type AgeId } from "./ages"
import type { AgeBuilding, StatBlock } from "./building"
import { aggregateStats, score, tileCount, type References } from "./efficiency"
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
  entities: CityEntity[]
}

export type CityRow = {
  building: AgeBuilding
  age: AgeId
  count: number
  tiles: number
  stats: StatBlock
  score: number
}

export type RatedCity = {
  rows: CityRow[]
  // Buildings FoE Atlas does not know (main building, Great Buildings, culture...): by name
  unknown: { name: string; count: number }[]
}

const isAge = (era: string | undefined): era is AgeId => AGES.some((age) => age.id === era)

// Age each building of the city is rated at: its own, else the player's
export function entityAge(city: City, entity: CityEntity, fallback: AgeId): AgeId {
  if (isAge(entity.era)) return entity.era
  return isAge(city.era) ? city.era : fallback
}

// Buildings of the city found in the wiki, at their own age, one row per building and age
// with its count; the others listed apart. `buildingsByAge`: the wiki's buildings of each age
// the city needs (see entityAge).
export function rateCity(
  city: City,
  assets: Record<string, string>,
  buildingsByAge: Partial<Record<AgeId, AgeBuilding[]>>,
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
  const counts = new Map<string, { building: AgeBuilding; age: AgeId; count: number }>()
  const unknown = new Map<string, number>()
  for (const entity of city.entities) {
    const id = assets[entity.assetId ?? entity.id] ?? assets[entity.id]
    const age = entityAge(city, entity, fallback)
    const building = id ? find(age, id) : undefined
    if (building) {
      const key = `${building.id}@${age}`
      const row = counts.get(key) ?? { building, age, count: 0 }
      counts.set(key, { ...row, count: row.count + 1 })
    } else {
      const name = entity.name ?? entity.id
      unknown.set(name, (unknown.get(name) ?? 0) + 1)
    }
  }
  const rows = [...counts.values()].map(({ building, age, count }) => {
    const tiles = tileCount(building.size, building.road)
    const stats = aggregateStats(building.age)
    const rated = score(stats, tiles, scoreKeys, references)
    return { building, age, count, tiles, stats, score: rated }
  })
  return {
    rows,
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
  // Multi-age buildings: their age, game era id minus 1 (1 = Bronze Age)
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
        }
      }),
  }
}
