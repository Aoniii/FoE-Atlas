import type { AgeId } from "@/core/ages"
import type { AgeBuilding, BuildingPage, BuildingType, StatBlock } from "@/core/building"
import type { ItemCard, ItemPage } from "@/core/game-item"
import type { GreatBuilding, GreatBuildingCard } from "@/core/great-building"
import type { RewardTables } from "@/core/rush"
import {
  aggregateStats,
  score,
  tileCount,
  type BoostBases,
  type References,
} from "@/core/efficiency"
import type { StatKey } from "@/core/stats"

export type DataIndex = {
  gameVersion: string | null
  scrapedAt: string
  ages: { id: AgeId; buildings: number }[]
  // Stat -> icon URL from the game CDN
  icons: Partial<Record<StatKey, string>>
  // Building types with data (the type filter options)
  types?: BuildingType[]
}

// One table row: the building plus everything computed from it
export type WikiRow = {
  building: AgeBuilding
  tiles: number
  stats: StatBlock
  score: number
}

export class DataNotFoundError extends Error {}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`)
  // The dev server answers missing files with index.html: not JSON means not found
  const isJson = response.headers.get("content-type")?.includes("json")
  if (response.status === 404 || (response.ok && !isJson)) throw new DataNotFoundError(path)
  if (!response.ok) throw new Error(`Cannot load ${path} (HTTP ${response.status})`)
  return response.json() as Promise<T>
}

export const fetchIndex = () => fetchJson<DataIndex>("index.json")
export const fetchAgeBuildings = (age: AgeId) => fetchJson<AgeBuilding[]>(`${age}.json`)
export const fetchGreatBuildings = () => fetchJson<GreatBuildingCard[]>("great-buildings.json")
export const fetchGreatBuilding = (id: string) =>
  fetchJson<GreatBuilding>(`great-buildings/${encodeURIComponent(id)}.json`)
// Game asset id -> building id (see scripts/build-data.ts)
export const fetchAssets = () =>
  fetchJson<{ buildings: Record<string, string>; greatBuildings: Record<string, string> }>(
    "assets.json",
  )
export const fetchItems = () => fetchJson<ItemCard[]>("items.json")
export const fetchItem = (id: string) => fetchJson<ItemPage>(`items/${encodeURIComponent(id)}.json`)
export const fetchGbRewards = () => fetchJson<RewardTables>("gb-rewards.json")
export const fetchBuilding = (id: string) =>
  fetchJson<BuildingPage>(`buildings/${encodeURIComponent(id)}.json`)

export function toRows(
  buildings: AgeBuilding[],
  scoreKeys: StatKey[],
  bases?: BoostBases,
  references?: References,
): WikiRow[] {
  return buildings.map((building) => {
    const tiles = tileCount(building.size, building.road)
    const stats = aggregateStats(building.age)
    return { building, tiles, stats, score: score(stats, tiles, scoreKeys, references, bases) }
  })
}
