// Great Building rush: what leveling from one level to another costs the owner when
// the five patron places are given away. Rules and reward tables come from FoE Helper
// (AGPL-3.0, see NOTICE.md); level costs follow the game formula (checked against
// every level of the official wiki).

import { AGES, type AgeId } from "./ages"
import { GB_MAX_LEVEL } from "./great-building"

// First place base reward, keyed by FoE Helper era id, indexed by level - 1
export type RewardTables = Record<string, number[]>

// FoE Helper era ids: 0 = all ages, 1 = Stone Age, 2 = Bronze Age...
export function eraId(age: AgeId | undefined): number {
  return age ? AGES.findIndex((a) => a.id === age) + 2 : 0
}

// FoE Helper rounding (Math.round with a float tolerance)
const round = (value: number) => Math.round(value + 0.000001)

// Cost of a level: own values up to level 10, then +2.5% per level (rounded up)
export function levelCost(firstTenCosts: number[], level: number): number {
  if (level <= 10) return firstTenCosts[level - 1]
  return Math.ceil(firstTenCosts[9] * Math.pow(1.025, level - 10))
}

// The game computes P1 as ceil5((era + 9) * A(level)): A is narrowed down per level by
// intersecting what every known era table implies, for eras or levels without a table
export function p1Curve(tables: RewardTables): number[] {
  const lows: number[] = []
  const highs: number[] = []
  for (const [key, table] of Object.entries(tables)) {
    const era = Number(key)
    if (era === 0) continue // all-age table duplicates another era
    table.forEach((reward, i) => {
      lows[i] = Math.max(lows[i] ?? -Infinity, (reward - 5) / (era + 9))
      highs[i] = Math.min(highs[i] ?? Infinity, reward / (era + 9))
    })
  }
  return lows.map((low, i) => (low + highs[i]) / 2)
}

export function p1Reward(
  tables: RewardTables,
  curve: number[],
  era: number,
  level: number,
): { reward: number; estimated: boolean } | undefined {
  const known = tables[era]?.[level - 1]
  if (known !== undefined) return { reward: known, estimated: false }
  const a = curve[level - 1]
  if (a === undefined) return undefined
  return { reward: Math.ceil(((era + 9) * a) / 5) * 5, estimated: true }
}

// Rewards of places 1-5: P(n) = round5(P(n-1) / n), then x (1 + arc bonus of the place).
// A closed place (null) is kept by the owner: nobody deposits for it.
export function patronRewards(p1: number, arcs: (number | null)[]): number[] {
  const base = [p1]
  for (let i = 1; i < 5; i++) base[i] = round(base[i - 1] / (i + 1) / 5) * 5
  return base.map((reward, i) => {
    const arc = arcs[i]
    return arc === null || arc === undefined ? 0 : round(reward * (1 + arc / 100))
  })
}

export type RushLevel = {
  level: number
  cost: number
  places: number[]
  own: number
  estimated: boolean
}

export type RushPlan = {
  levels: RushLevel[]
  cost: number
  patrons: number
  own: number
  // Highest level with a known or estimated reward
  maxLevel: number
}

// Levels from `from` (current level) up to `to`, each paid by the places then the owner
export function rushPlan(options: {
  firstTenCosts: number[]
  tables: RewardTables
  age: AgeId | undefined
  from: number
  to: number
  arcs: (number | null)[]
}): RushPlan {
  const era = eraId(options.age)
  const curve = p1Curve(options.tables)
  const maxLevel = Math.min(GB_MAX_LEVEL, Math.max(options.tables[era]?.length ?? 0, curve.length))
  const levels: RushLevel[] = []
  for (let level = options.from + 1; level <= Math.min(options.to, maxLevel); level++) {
    const cost = levelCost(options.firstTenCosts, level)
    const p1 = p1Reward(options.tables, curve, era, level)
    if (!p1) break
    const places = patronRewards(p1.reward, options.arcs)
    // Places cannot bring more than the level costs
    const patrons = Math.min(
      places.reduce((sum, value) => sum + value, 0),
      cost,
    )
    levels.push({ level, cost, places, own: cost - patrons, estimated: p1.estimated })
  }
  const sum = (pick: (level: RushLevel) => number) => levels.reduce((s, l) => s + pick(l), 0)
  return {
    levels,
    cost: sum((l) => l.cost),
    patrons: sum((l) => l.cost - l.own),
    own: sum((l) => l.own),
    maxLevel,
  }
}
