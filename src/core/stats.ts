// Every stat a building can provide. All production values are per 24h.
//
// `reference` is the amount per tile worth 1 score point (from the reference
// spreadsheet). Stats without a reference are displayed but never scored.
// A percent boost has no reference of its own: it is converted to
// `equivalent` units of the stat it `boosts`, then scored with that stat's reference.

export type StatGroup =
  "fp" | "goods" | "attacking_army" | "defending_army" | "quantum_incursions" | "other"

export type StatDef = {
  group: StatGroup
  unit: "flat" | "percent"
  reference?: number
  boosts?: string
  equivalent?: number
}

const ARMY_CONTEXTS = ["classic", "gbg", "ge", "qi"] as const

// Attack / defense references per context, for the attacking then the defending army
const ARMY_REFERENCES = {
  attacking: { classic: [12, 12], gbg: [15, 15], ge: [100, 100], qi: [5, 8] },
  defending: { classic: [12, 12], gbg: [15, 15], ge: [100, 100], qi: [50, 80] },
} as const

function armyStats(army: "attacking" | "defending") {
  const prefix = army === "attacking" ? "atk_army" : "def_army"
  const group: StatGroup = army === "attacking" ? "attacking_army" : "defending_army"
  return Object.fromEntries(
    ARMY_CONTEXTS.flatMap((context) => {
      const [attRef, defRef] = ARMY_REFERENCES[army][context]
      return [
        [`${prefix}_att_${context}`, { group, unit: "percent", reference: attRef }],
        [`${prefix}_def_${context}`, { group, unit: "percent", reference: defRef }],
      ]
    }),
  ) as Record<`${typeof prefix}_${"att" | "def"}_${(typeof ARMY_CONTEXTS)[number]}`, StatDef>
}

export const STATS = {
  fp: { group: "fp", unit: "flat", reference: 10 },
  fp_boost: { group: "fp", unit: "percent", boosts: "fp", equivalent: 200 },

  goods_prev: { group: "goods", unit: "flat", reference: 12 },
  goods: { group: "goods", unit: "flat", reference: 10 },
  goods_next: { group: "goods", unit: "flat", reference: 10 },
  special_goods: { group: "goods", unit: "flat", reference: 50 },
  goods_boost: { group: "goods", unit: "percent", boosts: "goods", equivalent: 300 },
  guild_goods: { group: "goods", unit: "flat", reference: 15 },
  guild_goods_boost: { group: "goods", unit: "percent", boosts: "guild_goods", equivalent: 450 },

  ...armyStats("attacking"),
  ...armyStats("defending"),

  qi_supplies: { group: "quantum_incursions", unit: "flat" },
  qi_supplies_boost: { group: "quantum_incursions", unit: "percent" },
  qi_coins_boost: { group: "quantum_incursions", unit: "percent" },
  qi_coins: { group: "quantum_incursions", unit: "flat" },
  qi_goods: { group: "quantum_incursions", unit: "flat" },
  qi_units: { group: "quantum_incursions", unit: "flat" },
  qi_actions: { group: "quantum_incursions", unit: "flat" },
  qi_actions_capacity: { group: "quantum_incursions", unit: "flat" },

  units: { group: "other", unit: "flat", reference: 15 },
  fsp: { group: "other", unit: "flat", reference: 0.05 },
  coins: { group: "other", unit: "flat" },
  coins_boost: { group: "other", unit: "percent" },
  supplies: { group: "other", unit: "flat" },
  supplies_boost: { group: "other", unit: "percent" },
  diamonds: { group: "other", unit: "flat" },
  medals: { group: "other", unit: "flat" },
  population: { group: "other", unit: "flat" },
  happiness: { group: "other", unit: "flat" },
} satisfies Record<string, StatDef>

export type StatKey = keyof typeof STATS

export const STAT_KEYS = Object.keys(STATS) as [StatKey, ...StatKey[]]

export function statDef(key: StatKey): StatDef {
  return STATS[key]
}

export const STAT_GROUPS = [...new Set(Object.values(STATS).map((def) => def.group))] as StatGroup[]

export function statsOfGroup(group: StatGroup): StatKey[] {
  return STAT_KEYS.filter((key) => STATS[key].group === group)
}
