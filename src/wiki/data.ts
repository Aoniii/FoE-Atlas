import type { AgeId } from "@/core/ages"
import type { AgeBuilding, StatBlock } from "@/core/building"
import { aggregateStats, score, tileCount, type References } from "@/core/efficiency"
import type { StatKey } from "@/core/stats"

export type DataIndex = {
  gameVersion: string | null
  scrapedAt: string
  ages: { id: AgeId; buildings: number }[]
  // Stat -> icon URL from the game CDN
  icons: Partial<Record<StatKey, string>>
}

// One table row: the building plus everything computed from it
export type WikiRow = {
  building: AgeBuilding
  tiles: number
  stats: StatBlock
  score: number
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`)
  if (!response.ok) throw new Error(`Cannot load ${path} (HTTP ${response.status})`)
  return response.json() as Promise<T>
}

export const fetchIndex = () => fetchJson<DataIndex>("index.json")
export const fetchAgeBuildings = (age: AgeId) => fetchJson<AgeBuilding[]>(`${age}.json`)

export function toRows(
  buildings: AgeBuilding[],
  scoreKeys: StatKey[],
  references?: References,
): WikiRow[] {
  return buildings.map((building) => {
    const tiles = tileCount(building.size, building.road)
    const stats = aggregateStats(building.age)
    return { building, tiles, stats, score: score(stats, tiles, scoreKeys, references) }
  })
}
