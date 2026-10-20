import type { Road, Size, StatBlock } from "./building"
import { STATS, type StatDef, type StatKey } from "./stats"

// Share of road tiles a building is charged for: half its short side for a
// regular road, the full short side for a two-lane road
export function roadShare(size: Size, road: Road): number {
  const shortSide = Math.min(size.w, size.h)
  if (road === "road") return shortSide / 2
  if (road === "two_lane") return shortSide
  return 0
}

export function tileCount(size: Size, road: Road): number {
  return size.w * size.h + roadShare(size, road)
}

export type References = Partial<Record<StatKey, number>>

export const DEFAULT_REFERENCES: References = Object.fromEntries(
  Object.entries(STATS as Record<StatKey, StatDef>).flatMap(([key, def]) =>
    def.reference === undefined ? [] : [[key, def.reference]],
  ),
)

export function isScorable(key: StatKey, references: References = DEFAULT_REFERENCES): boolean {
  const def: StatDef = STATS[key]
  const base = (def.boosts ?? key) as StatKey
  return references[base] !== undefined
}

// Score = sum over selected stats of (value per tile / reference per tile)
export function score(
  stats: StatBlock,
  tiles: number,
  selected: Iterable<StatKey>,
  references: References = DEFAULT_REFERENCES,
): number {
  let total = 0
  for (const key of selected) {
    const value = stats[key]
    if (!value) continue
    const def: StatDef = STATS[key]
    // A percent boost is first converted to units of the stat it boosts
    const base = (def.boosts ?? key) as StatKey
    const amount = def.boosts ? value * (def.equivalent ?? 0) : value
    const reference = references[base]
    if (reference) total += amount / tiles / reference
  }
  return total
}
