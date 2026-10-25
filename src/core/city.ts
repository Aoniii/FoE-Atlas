// A player's main city, read from a FoE Helper export, and how profitable each of its
// buildings is: at the building's own age, Great Buildings at their level.

import { AGES, LATEST_AGE, type AgeId } from "./ages"
import type { AgeBuilding, StatBlock } from "./building"
import { aggregateStats, score, tileCount, type BoostBases, type References } from "./efficiency"
import type { GameBuilding, LinkRegion } from "./game-building"
import { isCityBuilding, toGameBuilding, type Definition } from "./game-definitions"
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
  // Tiles taken, and the road it needs (0 none, 1 road, 2 two-lane road), from the export's
  // definition (missing in cities imported before)
  w?: number
  h?: number
  road?: RoadLevel
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
  // The game's definitions of the city's buildings, from the export (see parseFoeHelperExport)
  definitions?: Record<string, GameBuilding>
  entities: CityEntity[]
  // For the map: the unlocked expansions and the roads (missing in cities imported before)
  areas?: MapRect[]
  // level: 2 for two-lane roads (missing: a road)
  streets?: (MapRect & { level?: RoadLevel })[]
}

// A rectangle of the city map, in tiles: x to the right, y down
export type MapRect = { x: number; y: number; w: number; h: number }

// Road a building needs, or a road gives: 0 none, 1 road, 2 two-lane road
export type RoadLevel = 0 | 1 | 2

// A building on the city map, with the table row it is counted in (a chain link: its start's);
// name: the game's, for the buildings without a row (town hall...)
export type MapBuilding = MapRect & { name: string; row?: CityRow }

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
  // Known only from the city's export: no page on the site
  local?: boolean
  // Chain links counted in this start building (and which ones), adjacent buildings of its set
  links?: number
  linked?: {
    id: string
    name: { fr: string; en: string }
    age: AgeId
    count: number
    local?: boolean
  }[]
  setNeighbours?: number
  count: number
  tiles: number
  stats: StatBlock
  score: number
}

// City entities that are not buildings (off-grid features, ships, friends tavern...)
const NOT_BUILDINGS = new Set([
  "street",
  "off_grid",
  "outpost_ship",
  "friends_tavern",
  "impediment",
  // Harbour main buildings: produce nothing the score counts
  "hub_main",
])

export type RatedCity = {
  rows: CityRow[]
  // Every building of the city where it stands
  map: MapBuilding[]
  // Buildings that only count together where they stand, by index in city.entities: a chain
  // start with its attached links, set buildings touching each other
  groups: number[][]
  // By index in city.entities: the family of each building (its upgrade chain, all levels
  // together, else the building itself) and its rank in it (level, then age)
  traits: ({ family: string; rank: number } | undefined)[]
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
// Adds a block of stats into another one
function addStats(into: StatBlock, from: StatBlock) {
  for (const [key, value] of Object.entries(from) as [StatKey, number][]) {
    into[key] = (into[key] ?? 0) + value
  }
}

// Known only from the city's export (see fromDefinition): no page on the site
const isLocal = (building: AgeBuilding) => !building.image && building.id === building.gameId

// A building the wiki does not know, from the game's definition in the city's export
function fromDefinition(city: City, gameId: string, age: AgeId): AgeBuilding | undefined {
  const definition = city.definitions?.[gameId]
  const data = definition?.ages[age]
  if (!definition || !data) return undefined
  const { name, type, size, road, links } = definition
  return {
    id: gameId,
    name: { fr: name, en: name },
    type,
    size,
    road,
    reliability: "official",
    gameId,
    ...(links && { links }),
    age: data,
  }
}

// A building of the city found in the wiki, at its age
type Placed = { entity: CityEntity; age: AgeId; building: AgeBuilding }

const inRegion = (from: Placed, to: Placed, region: LinkRegion) => {
  const dx = to.entity.x - from.entity.x
  const dy = to.entity.y - from.entity.y
  return dx >= region.x1 && dx <= region.x2 && dy >= region.y1 && dy <= region.y2
}

// Links attached to a chain start, one after the other from where each one points to
function chainLinks(start: Placed, links: Placed[], used: Set<Placed>): Placed[] {
  const chain: Placed[] = []
  let current = start
  for (;;) {
    const region = current.building.links?.chain?.next
    const next =
      region &&
      links.find(
        (link) =>
          !used.has(link) &&
          link.building.links?.chain?.id === start.building.links?.chain?.id &&
          inRegion(current, link, region),
      )
    if (!next) return chain
    used.add(next)
    chain.push(next)
    current = next
  }
}

// Attached links by building and age: "Lotus Flower Lake ×4"
function groupLinks(chain: Placed[]): NonNullable<CityRow["linked"]> {
  const groups = new Map<string, NonNullable<CityRow["linked"]>[number]>()
  for (const { building, age } of chain) {
    const key = `${building.id}@${age}`
    const group = groups.get(key) ?? {
      id: building.id,
      name: building.name,
      age,
      count: 0,
      ...(isLocal(building) && { local: true }),
    }
    groups.set(key, { ...group, count: group.count + 1 })
  }
  return [...groups.values()]
}

// Distinct buildings of the same set touching this one along a side
function setNeighbours(placed: Placed, all: Placed[]): number {
  const id = placed.building.links?.set?.id
  return all.filter(
    (other) => other !== placed && other.building.links?.set?.id === id && touch(placed, other),
  ).length
}

// Two buildings sharing a side (not only a corner)
function touch(a: Placed, b: Placed): boolean {
  const { x, y } = a.entity
  const { w, h } = a.building.size
  const ox = b.entity.x
  const oy = b.entity.y
  const { w: ow, h: oh } = b.building.size
  const overlapX = ox < x + w && ox + ow > x
  const overlapY = oy < y + h && oy + oh > y
  const sideX = ox + ow === x || ox === x + w
  const sideY = oy + oh === y || oy === y + h
  return (sideX && overlapY) || (sideY && overlapX)
}

// Buildings of the city found in the wiki, at their own age, and Great Buildings at their
// level: one row per building and age (or Great Building and level) with its count; the
// others listed apart. A chain counts as its start building with every attached link
// (their values, their link bonus and their tiles); a set building adds one bonus per
// adjacent building of its set. `buildingsByAge`: the wiki's buildings of each age the city
// needs (see entityAge); `greatBuildings`: those of the city (see greatBuildingId).
export function rateCity(
  city: City,
  assets: CityAssets,
  buildingsByAge: Partial<Record<AgeId, AgeBuilding[]>>,
  greatBuildings: Record<string, GreatBuilding>,
  fallback: AgeId,
  scoreKeys: StatKey[],
  bases?: BoostBases,
  references?: References,
): RatedCity {
  const lookup = new Map<AgeId, Map<string, AgeBuilding>>()
  const find = (age: AgeId, id: string) => {
    if (!lookup.has(age))
      lookup.set(age, new Map((buildingsByAge[age] ?? []).map((b) => [b.id, b])))
    return lookup.get(age)!.get(id)
  }
  const rows = new Map<string, CityRow>()
  // Row key of each entity, for the map
  const rowOf = new Map<CityEntity, string>()
  const sizeOf = new Map<CityEntity, { w: number; h: number }>()
  const add = (key: string, row: Omit<CityRow, "count" | "score">) => {
    const count = (rows.get(key)?.count ?? 0) + 1
    rows.set(key, {
      ...row,
      count,
      score: score(row.stats, row.tiles, scoreKeys, references, bases),
    })
  }
  const unknown = new Map<string, number>()
  const placed: Placed[] = []
  for (const entity of city.entities) {
    if (entity.type && NOT_BUILDINGS.has(entity.type)) continue
    const age = entityAge(city, entity, fallback)
    const gb = greatBuildings[greatBuildingId(entity, assets) ?? ""]
    if (gb && entity.level) {
      const { id, name, image, size, road } = gb
      const stats = greatBuildingStats(gb, entity.level)
      const tiles = tileCount(size, road)
      rowOf.set(entity, `gb:${id}@${entity.level}`)
      sizeOf.set(entity, size)
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
    const building = (id ? find(age, id) : undefined) ?? fromDefinition(city, entity.id, age)
    if (building) {
      placed.push({ entity, age, building })
      sizeOf.set(entity, building.size)
    } else {
      const name = entity.name ?? entity.id
      unknown.set(name, (unknown.get(name) ?? 0) + 1)
    }
  }

  // Chains first: links attached to a start are counted in it
  const links = placed.filter((p) => p.building.links?.chain?.role === "link")
  const used = new Set<Placed>()
  const attached = new Map<Placed, Placed[]>()
  for (const start of placed.filter((p) => p.building.links?.chain?.role === "start")) {
    attached.set(start, chainLinks(start, links, used))
  }

  for (const item of placed) {
    if (used.has(item)) continue
    const { building, age } = item
    const stats = aggregateStats(building.age)
    let tiles = tileCount(building.size, building.road)
    const chain = attached.get(item) ?? []
    for (const link of chain) {
      addStats(stats, aggregateStats(link.building.age))
      const bonus = link.building.links?.chain?.bonus?.[link.age]
      if (bonus) addStats(stats, aggregateStats(bonus))
      tiles += tileCount(link.building.size, link.building.road)
    }
    const set = building.links?.set
    const neighbours = set?.bonuses ? setNeighbours(item, placed) : 0
    for (const bonus of (set?.bonuses?.[age] ?? []).slice(0, neighbours)) {
      addStats(stats, aggregateStats(bonus))
    }
    const { name, image } = building
    const key = `${building.id}@${age}+${chain.length}/${neighbours}`
    for (const p of [item, ...chain]) rowOf.set(p.entity, key)
    add(key, {
      kind: "building",
      // Only from the export: no page on the site
      ...(isLocal(building) && { local: true }),
      id: building.id,
      name,
      image,
      age,
      tiles,
      stats,
      ...(chain.length && { links: chain.length, linked: groupLinks(chain) }),
      ...(neighbours && { setNeighbours: neighbours }),
    })
  }
  // Groups: chain starts with their links, set buildings touching (union-find)
  const index = new Map(city.entities.map((entity, i) => [entity, i]))
  const parent = city.entities.map((_, i) => i)
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])))
  const join = (a: CityEntity, b: CityEntity) => {
    parent[root(index.get(a)!)] = root(index.get(b)!)
  }
  for (const [start, chain] of attached) for (const link of chain) join(start.entity, link.entity)
  for (const a of placed) {
    const set = a.building.links?.set?.id
    if (!set) continue
    for (const b of placed) {
      if (a !== b && b.building.links?.set?.id === set && touch(a, b)) join(a.entity, b.entity)
    }
  }
  const members = new Map<number, number[]>()
  city.entities.forEach((_, i) => members.set(root(i), [...(members.get(root(i)) ?? []), i]))
  const groups = [...members.values()].filter((group) => group.length > 1)

  const traits: RatedCity["traits"] = city.entities.map(() => undefined)
  for (const { entity, age, building } of placed) {
    traits[index.get(entity)!] = {
      family: building.chain?.id ?? building.id,
      rank: (building.chain?.level ?? 0) * 100 + AGES.findIndex((a) => a.id === age),
    }
  }

  const map = city.entities.flatMap((entity): MapBuilding[] => {
    const size = entity.w && entity.h ? { w: entity.w, h: entity.h } : sizeOf.get(entity)
    if (!size) return []
    const key = rowOf.get(entity)
    const row = key ? rows.get(key) : undefined
    const name = entity.name ?? entity.id
    return [{ x: entity.x, y: entity.y, ...size, name, ...(row && { row }) }]
  })
  return {
    rows: [...rows.values()],
    map,
    groups,
    traits,
    unknown: [...unknown]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  }
}

// One key per line of the rated city, the same after the score settings change
export const rowKey = (row: CityRow) =>
  `${row.kind}:${row.id}@${row.level ?? row.age}+${row.links ?? 0}/${row.setNeighbours ?? 0}`

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
type FoeHelperDefinition = {
  asset_id?: string
  name?: string
  width?: number
  length?: number
  components?: {
    AllAge?: {
      placement?: { size?: { x: number; y: number } }
      streetConnectionRequirement?: { requiredLevel?: number }
    }
  }
  requirements?: { street_connection_level?: number }
}

// Road a definition needs (a street: the road it is)
function definitionRoad(def: FoeHelperDefinition): RoadLevel {
  const level =
    def.requirements?.street_connection_level ??
    def.components?.AllAge?.streetConnectionRequirement?.requiredLevel ??
    0
  return level >= 2 ? 2 : level >= 1 ? 1 : 0
}

// Tiles a definition takes: newer buildings in their components, older ones in width/length
function definitionSize(def: FoeHelperDefinition): { w: number; h: number } | undefined {
  const placed = def.components?.AllAge?.placement?.size
  const w = placed?.x ?? def.width
  const h = placed?.y ?? def.length
  return w && h ? { w, h } : undefined
}

// Expansions of the player's map; a missing x or y is 0
type UnlockedArea = { x?: number; y?: number; width?: number; length?: number }

const onMap = (entity: FoeHelperEntity, areas: UnlockedArea[]) => {
  const x = entity.x ?? 0
  const y = entity.y ?? 0
  return areas.some(
    (area) =>
      x >= (area.x ?? 0) &&
      x < (area.x ?? 0) + (area.width ?? 0) &&
      y >= (area.y ?? 0) &&
      y < (area.y ?? 0) + (area.length ?? 0),
  )
}

export class FoeHelperFormatError extends Error {}

export function parseFoeHelperExport(json: unknown, fileName?: string): City {
  const data = json as {
    CityMapData?: unknown
    CityEntities?: Record<string, FoeHelperDefinition>
    UnlockedAreas?: UnlockedArea[]
  }
  if (!data?.CityMapData || typeof data.CityMapData !== "object") {
    throw new FoeHelperFormatError("Not a FoE Helper city map export")
  }
  const raw = Object.values(data.CityMapData as Record<string, FoeHelperEntity>)
  const definitions = data.CityEntities ?? {}
  const file = fileName?.match(/^([a-z]+\d+)_citymap_[\d-]+_(\d+)\.json$/i)
  // The export has no player age: the town hall's id carries it ("H_SpaceAgeTitan_Townhall")
  const townHall = raw.find((entity) => entity.type === "main_building")?.cityentity_id
  const onCityMap = raw
    .filter((entity) => entity.cityentity_id)
    // Outside the player's map: harbours, guild buildings, taverns, ships...
    .filter((entity) => !data.UnlockedAreas?.length || onMap(entity, data.UnlockedAreas))
  const rect = (x = 0, y = 0, size = { w: 1, h: 1 }): MapRect => ({ x, y, ...size })
  const city: City = {
    world: file?.[1].toLowerCase() ?? "foe-helper",
    playerId: Number(file?.[2] ?? 0),
    era: townHall?.match(/^H_([A-Za-z]+)_/)?.[1],
    updatedAt: new Date().toISOString(),
    entities: onCityMap
      .filter((entity) => entity.type !== "street")
      .map((entity) => {
        const definition = definitions[entity.cityentity_id!] ?? {}
        return {
          id: entity.cityentity_id!,
          ...(definition.asset_id && { assetId: definition.asset_id }),
          ...(definition.name && { name: definition.name }),
          type: entity.type,
          x: entity.x ?? 0,
          y: entity.y ?? 0,
          ...definitionSize(definition),
          ...(definitionSize(definition) && { road: definitionRoad(definition) }),
          connected: entity.connected === 1,
          ...(ownAge(entity) && { era: ownAge(entity) }),
          ...(entity.type === "greatbuilding" && entity.level && { level: entity.level }),
        }
      }),
    areas: (data.UnlockedAreas ?? []).map((area) =>
      rect(area.x, area.y, { w: area.width ?? 0, h: area.length ?? 0 }),
    ),
    streets: onCityMap
      .filter((entity) => entity.type === "street")
      .map((entity) => {
        const definition = definitions[entity.cityentity_id!] ?? {}
        const level = definitionRoad(definition)
        return {
          ...rect(entity.x, entity.y, definitionSize(definition)),
          ...(level === 2 && { level }),
        }
      }),
  }
  // The game's own definition of every building of the city, at the ages it is rated at:
  // rates the buildings the wiki does not know, with their chain and set links
  const ages = new Map<string, Set<AgeId>>()
  for (const entity of city.entities) {
    const age = entityAge(city, entity, LATEST_AGE)
    ages.set(entity.id, (ages.get(entity.id) ?? new Set()).add(age))
  }
  const own: Record<string, GameBuilding> = {}
  for (const [id, used] of ages) {
    const definition = definitions[id] as Definition | undefined
    if (definition && isCityBuilding(definition)) own[id] = toGameBuilding(definition, [...used])
  }
  return { ...city, definitions: own }
}

// Daily production of the city the percent boosts apply to: FP, goods of the three ages and
// guild goods of every rated building and Great Building
export function cityProduction(rows: CityRow[]): BoostBases {
  const sum = (keys: StatKey[]) =>
    Math.round(
      rows.reduce(
        (total, row) => total + row.count * keys.reduce((s, key) => s + (row.stats[key] ?? 0), 0),
        0,
      ),
    )
  return {
    fp: sum(["fp"]),
    goods: sum(["goods_prev", "goods", "goods_next"]),
    guild_goods: sum(["guild_goods"]),
  }
}
