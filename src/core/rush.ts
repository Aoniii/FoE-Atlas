// Great Building rush: what leveling from one level to another costs the owner when the
// patron places are given away. Level costs and rewards follow the prestige rework rules of
// FoE Helper (AGPL-3.0, see NOTICE.md and gb-prestige.ts): five places on copper levels, seven
// on the Gold levels of a Gold building, each tier with its own arc bonus.

import { patronBaseRewards, placeCount, prestigeCostAt, type Prestige } from "./gb-prestige"

// FoE Helper rounding (Math.round with a float tolerance)
const round = (value: number) => Math.round(value + 0.000001)

// Reward of each place with its arc bonus; a closed place (null) is kept by the owner
export function patronRewards(base: number[], arcs: (number | null)[]): number[] {
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
}

export type RushPlan = {
  levels: RushLevel[]
  cost: number
  patrons: number
  own: number
}

// Levels from `from` (current level) up to `to`, each paid by the places then the owner.
// `copper` and `gold`: the arc bonus of each place on copper and Gold levels (null: closed)
export function rushPlan(options: {
  prestige: Prestige
  from: number
  to: number
  copper: (number | null)[]
  gold: (number | null)[]
}): RushPlan {
  const { prestige } = options
  const levels: RushLevel[] = []
  for (let level = options.from + 1; level <= Math.min(options.to, prestige.maxLevel); level++) {
    const cost = prestigeCostAt(prestige, level)
    if (cost === undefined) break
    const arcs = placeCount(prestige, level) === 7 ? options.gold : options.copper
    const places = patronRewards(patronBaseRewards(prestige, level, cost), arcs)
    // Places cannot bring more than the level costs
    const patrons = Math.min(
      places.reduce((sum, value) => sum + value, 0),
      cost,
    )
    levels.push({ level, cost, places, own: cost - patrons })
  }
  const sum = (pick: (level: RushLevel) => number) => levels.reduce((s, l) => s + pick(l), 0)
  return {
    levels,
    cost: sum((l) => l.cost),
    patrons: sum((l) => l.cost - l.own),
    own: sum((l) => l.own),
  }
}
