// Great Buildings since the prestige rework (live servers, November 5, 2026), from the
// game's own data (data/gb-prestige.json, see scripts/gb-prestige.ts). Copper bonuses grow
// from level 1 to 200, Gold bonuses from level 101 to 500. The game only sends each bonus's
// exact value at a few breakpoints (1, 101, 200 or 201, 301, 401, 500); levels in between,
// level costs and patron rewards follow FoE Helper's rules (AGPL-3.0, see NOTICE.md), which
// reproduce the game and the costs InnoGames announced.

import { z } from "zod"

export const PrestigeTierSchema = z.enum(["copper", "gold"])
export type PrestigeTier = z.infer<typeof PrestigeTierSchema>

// "6 x 64%": count 6 (charges, units...), value 64
export const PrestigeValueSchema = z.object({ count: z.number().optional(), value: z.number() })
export type PrestigeValue = z.infer<typeof PrestigeValueSchema>

export const PrestigeColumnSchema = z.object({
  // Game names ("clan_goods", "guild_expedition"), see BONUS_NAMES
  bonus: z.string(),
  context: z.string(),
  tier: PrestigeTierSchema,
  percent: z.boolean(),
  // File in public/bonus-icons/, from the game's icon sheet
  icon: z.string().optional(),
  // Exact values at the breakpoints, in level order
  milestones: z.array(
    z.object({ level: z.number().int().positive() }).extend(PrestigeValueSchema.shape),
  ),
})
export type PrestigeColumn = z.infer<typeof PrestigeColumnSchema>

export const PrestigeSchema = z.object({
  // Game id ("X_IronAge_Landmark2")
  gameId: z.string(),
  maxLevel: z.number().int().positive(),
  // FP of levels 1 to 10
  firstTenCosts: z.array(z.number()),
  // FP added per level past 10 (FoE Helper's steps for 10-39, 40-69, 70-99, 100-300, then
  // 301-400 and 401+ for Gold), or every level costing as much as the first one more (linear)
  steps: z.array(z.number()).optional(),
  linear: z.boolean().optional(),
  columns: z.array(PrestigeColumnSchema),
})
export type Prestige = z.infer<typeof PrestigeSchema>

export const COPPER_MAX_LEVEL = 200
export const GOLD_FIRST_LEVEL = 101
export const GOLD_MAX_LEVEL = 500

// Shape constant of the curve every bonus follows between its breakpoints
const BONUS_CURVE = 3.53612

// Value of a series of breakpoints at a level: exact on a breakpoint, else a + b * (1 -
// e^(-k * x^1.2)) with x the progress within the tier (copper: levels 1-200, gold: from its
// first level to its last breakpoint), a and b fitted on the breakpoints (FoE Helper)
function curveAt(points: { level: number; value: number }[], level: number, gold: boolean) {
  const exact = points.find((p) => p.level === level)
  if (exact) return exact.value
  const levels = points.map((p) => p.level)
  const first = levels[gold ? 1 : 0]
  if (first === undefined || level < first) return 0
  const start = gold ? first - 1 : 0
  const end = gold ? levels[levels.length - 1] : COPPER_MAX_LEVEL
  const x = (l: number) =>
    1 - Math.exp(-BONUS_CURVE * Math.pow(Math.min(Math.max(l - start, 0) / (end - start), 1), 1.2))
  // Breakpoints the value still grows on (the ones past the end repeat the maximum)
  const fitted = points.filter(
    (p, i) => p.level >= first && (p.level <= end || levels[i - 1] < end),
  )
  const lower = points.filter((p) => p.level <= level).at(-1)!
  const upper = points.find((p) => p.level > level)
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (const p of fitted) {
    const v = x(p.level)
    sx += v
    sy += p.value
    sxx += v * v
    sxy += v * p.value
  }
  const divisor = fitted.length * sxx - sx * sx
  if (fitted.length < 2 || !(divisor > 0)) return lower.value
  const b = (fitted.length * sxy - sx * sy) / divisor
  const a = (sy - b * sx) / fitted.length
  // Never out of the surrounding breakpoints
  return Math.round(Math.min(Math.max(a + b * x(level), lower.value), upper?.value ?? Infinity))
}

// Value of a bonus at a level; null while its tier is locked
export function prestigeValueAt(column: PrestigeColumn, level: number): PrestigeValue | null {
  if (column.tier === "gold" && level < GOLD_FIRST_LEVEL) return null
  const gold = column.tier === "gold"
  const value = curveAt(column.milestones, level, gold)
  const counts = column.milestones.flatMap((m) =>
    m.count === undefined ? [] : [{ level: m.level, value: m.count }],
  )
  return {
    value,
    ...(counts.length === column.milestones.length && { count: curveAt(counts, level, gold) }),
  }
}

// FP of a level (1-based): its own up to 10, then the steps of FoE Helper (level 100 costs
// 5% more than the curve before it), or the linear curve (Shattered Horizon Siphon)
export function prestigeCostAt(gb: Prestige, level: number): number | undefined {
  const from = level - 1
  if (level <= 10) return gb.firstTenCosts[from]
  if (gb.linear) {
    const entries = Math.min(2, Math.floor(from / 100))
    const extra = from === 100 || from === 200 ? 1.5 : 0
    return Math.round(gb.firstTenCosts[0] * (from + 1 - entries + extra))
  }
  const steps = gb.steps
  if (!steps) return undefined
  const segments: [end: number, step: number][] = [
    [39, 0],
    [69, 1],
    [99, 2],
    [300, 3],
    [400, 4],
    [Infinity, 5],
  ]
  let cost = gb.firstTenCosts[9]
  let start = 9
  for (const [end, index] of segments) {
    if (steps[index] === undefined) return undefined
    if (start === 99) {
      cost = Math.round((cost * 21) / 20)
      start = 100
    }
    if (from <= end) return cost + steps[index] * (from - start)
    cost += steps[index] * (end - start)
    start = end
  }
  return undefined
}

// Share of a level's FP the patron places get back, by the level reached: [last level, %]
export const PATRON_SHARES: [last: number, percent: number][] = [
  [9, 25],
  [39, 30],
  [69, 40],
  [100, 25],
  [200, 15],
  [300, 10],
  [400, 7],
  [Infinity, 5],
]

// Places rewarded at a level: five, seven on the Gold levels of a Gold building
export const placeCount = (gb: Prestige, level: number) =>
  gb.maxLevel > COPPER_MAX_LEVEL && level >= GOLD_FIRST_LEVEL ? 7 : 5

// Base reward of each place for a level (before the arc bonus): the share of its cost split
// by weights n!/k!, with the game's rounding (FoE Helper)
export function patronBaseRewards(gb: Prestige, level: number, cost: number): number[] {
  const share = PATRON_SHARES.find(([last]) => level <= last)![1]
  const count = placeCount(gb, level)
  const weights: number[] = []
  for (let i = count, weight = 1; i >= 1; i--) {
    weights[i - 1] = weight
    weight *= i
  }
  const sum = weights.reduce((total, weight) => total + weight, 0)
  return weights.map((weight) => {
    const reward = Math.round(((cost * share) / 100) * (weight / sum))
    return reward === 1 || reward === 3 ? reward + 1 : reward
  })
}

type Localized = { fr: string; en: string }

// Bonus names of the game, in the words of the rest of the site
export const BONUS_NAMES: Record<string, Localized> = {
  advanced_tactics: { fr: "Tactiques avancées", en: "Advanced Tactics" },
  age_reserves: { fr: "Réserve de ressources", en: "Goods Reserve" },
  aid_boost: { fr: "Bonus d'entraide", en: "Aid Boost" },
  aid_goods: { fr: "Ressources d'entraide", en: "Aid Goods" },
  algorithmic_core: { fr: "Noyau algorithmique", en: "Algorithmic Core" },
  all_units_critical_hit_chance: { fr: "Coup critique amélioré", en: "Enhanced Critical Hit" },
  allies_quest_boost: {
    fr: "Bonus de récompense des quêtes de la taverne héroïque",
    en: "Heroic Tavern Quest Reward Boost",
  },
  attack_boost: { fr: "Attaquants - Attaque", en: "Attackers - Attack" },
  attacker_defense_boost: {
    fr: "Attaquants - Défense",
    en: "Attackers - Defense",
  },
  clan_goods: { fr: "Ressources de la guilde", en: "Guild Goods" },
  clan_goods_extended: {
    fr: "Ressources de la guilde (ères voisines)",
    en: "Guild Goods (adjacent eras)",
  },
  contribution_boost: { fr: "Bonus de contribution", en: "Contribution Boost" },
  contribution_boost_gold: { fr: "Bonus de contribution (or)", en: "Contribution Boost (gold)" },
  critical_hit_chance: { fr: "Coup critique", en: "Critical Hit" },
  defender_attack_boost: {
    fr: "Défenseurs - Attaque",
    en: "Defenders - Attack",
  },
  defense_boost: { fr: "Défenseurs - Défense", en: "Defenders - Defense" },
  diplomatic_gifts: { fr: "Cadeaux diplomatiques", en: "Diplomatic Gifts" },
  double_collection: { fr: "Collecte doublée", en: "Double Collection" },
  fierce_resistance: { fr: "Défenseurs - Attaque et défense", en: "Defenders - Attack & Defense" },
  first_strike: { fr: "Première frappe", en: "First Strike" },
  goods_production_boost: { fr: "Bonus de production de ressources", en: "Goods Production Boost" },
  guild_raids_double_collection: {
    fr: "Collecte doublée (Incursions quantiques)",
    en: "Double Collection (Quantum Incursions)",
  },
  happiness: { fr: "Satisfaction", en: "Happiness" },
  helping_hands: { fr: "Aide entre joueurs", en: "Helping Hands" },
  helping_hands_boosted: { fr: "Aide entre joueurs améliorée", en: "Improved Helping Hands" },
  medals: { fr: "Médailles", en: "Medals" },
  military_ally_boost: { fr: "Bonus des alliés militaires", en: "Military Ally Boost" },
  military_boost: { fr: "Attaquants - Attaque et défense", en: "Attackers - Attack & Defense" },
  missile_launch: { fr: "Lancement de missile", en: "Missile Launch" },
  missile_launch_wave_2: {
    fr: "Lancement de missile (2e vague)",
    en: "Missile Launch (second wave)",
  },
  money: { fr: "Pièces", en: "Coins" },
  money_boost: { fr: "Bonus pièces", en: "Coin Boost" },
  mysterious_shards: { fr: "Éclats mystérieux", en: "Mysterious Shards" },
  penal_unit: { fr: "Unité pénitentiaire", en: "Penal Unit" },
  plunder_and_pillage: { fr: "Pillage et saccage", en: "Plunder and Pillage" },
  plunder_goods: { fr: "Ressources de pillage", en: "Plunder Goods" },
  plunder_repel: { fr: "Résistance au pillage", en: "Plunder Repel" },
  population: { fr: "Population", en: "Population" },
  previous_era_goods: { fr: "Ressources de l'ère précédente", en: "Previous Era Goods" },
  quest_boost: { fr: "Bonus de récompense de quête", en: "Quest Reward Boost" },
  random_goods: { fr: "Ressources", en: "Goods" },
  science_ally_boost: { fr: "Bonus des alliés scientifiques", en: "Science Ally Boost" },
  second_strike: { fr: "Seconde frappe", en: "Second Strike" },
  special_goods: { fr: "Ressources spéciales", en: "Special Goods" },
  special_goods_production_boost: {
    fr: "Bonus de production de ressources spéciales",
    en: "Special Goods Production Boost",
  },
  spoils_of_war: { fr: "Butins de guerre", en: "Spoils of War" },
  spoils_of_war_enhanced: { fr: "Butins de guerre améliorés", en: "Enhanced Spoils of War" },
  strategy_points: { fr: "Points Forge", en: "Forge Points" },
  supplies: { fr: "Marchandises", en: "Supplies" },
  supplies_boost: { fr: "Amélioration marchandises", en: "Supply Boost" },
  totem_drop: { fr: "Chasse à la relique", en: "Relic Hunt" },
}

// Where the bonus applies; nothing for "all"
export const BONUS_CONTEXTS: Record<string, Localized> = {
  battleground: { fr: "CBG", en: "GBG" },
  guild_expedition: { fr: "EG", en: "GE" },
  guild_raids: { fr: "IQ", en: "QI" },
}

// Army bonuses that multiply the player's existing ones (Gold effects)
const MULTIPLIERS = new Set([
  "attack_boost",
  "attacker_defense_boost",
  "defender_attack_boost",
  "defense_boost",
])
const isMultiplier = (column: Pick<PrestigeColumn, "bonus" | "context">) =>
  MULTIPLIERS.has(column.bonus) ||
  (["military_boost", "fierce_resistance"].includes(column.bonus) && column.context !== "all")

// "Défenseurs - Attaque et défense (multiplicateur, CBG)"; unknown names as sent by the game
export function bonusLabel(
  column: Pick<PrestigeColumn, "bonus" | "context">,
  locale: string,
): string {
  const lang = locale === "fr" ? "fr" : "en"
  const name = BONUS_NAMES[column.bonus]?.[lang] ?? column.bonus.replace(/_/g, " ")
  const details = [
    isMultiplier(column) && (lang === "fr" ? "multiplicateur" : "multiplier"),
    BONUS_CONTEXTS[column.context]?.[lang],
  ].filter(Boolean)
  return details.length ? `${name} (${details.join(", ")})` : name
}

// Where an army bonus applies, inside a sentence
const PLACES: Record<string, Localized> = {
  all: { fr: "", en: "" },
  battleground: { fr: " dans les champs de bataille de guilde", en: " in Guild Battlegrounds" },
  guild_expedition: { fr: " dans l'expédition de guilde", en: " in the Guild Expedition" },
  guild_raids: { fr: " dans les incursions quantiques", en: " in Quantum Incursions" },
}
const multiplies = (what: Localized): Localized => ({
  fr: `Multiplie tes bonus existants ${what.fr}{place} et ajoute le résultat à ton total.`,
  en: `Multiplies your existing ${what.en} bonuses{place} and adds the result to your total.`,
})

// What each Gold effect does, from the official announcement (October 2026); {place} is
// where it applies
const DESCRIPTIONS: Record<string, Localized> = {
  advanced_tactics: {
    fr: "Les unités d'attaque et de défense voient leurs valeurs d'attaque et de défense augmentées d'un pourcentage{place}.",
    en: "Attacking and defending units have their Attack and Defense values boosted by a percentage{place}.",
  },
  age_reserves: {
    fr: "Produit des ressources toutes les 24 heures, choisies au hasard parmi les types de ressources produits dans ta ville.",
    en: "Produces Goods every 24 hours, randomly chosen from any type of Goods building placed in your City.",
  },
  all_units_critical_hit_chance: {
    fr: "Donne une chance d'infliger 150 % de dégâts aux unités ennemies de toute ère autre que celle de ton unité. Ne s'applique pas aux voyous.",
    en: "Grants a chance to deal 150% damage against enemy units from any Age except your unit's Age. Doesn't apply to Rogues.",
  },
  allies_quest_boost: {
    fr: "Quand tu reçois les récompenses des quêtes de la taverne héroïque, tu obtiens un pourcentage en plus.",
    en: "When you get rewards from Heroic Tavern quests, you receive an additional percentage on top.",
  },
  attack_boost: multiplies({
    fr: "d'attaque de l'armée d'attaque",
    en: "Attack for Attacking Army",
  }),
  attacker_defense_boost: multiplies({
    fr: "de défense de l'armée d'attaque",
    en: "Defense for Attacking Army",
  }),
  defender_attack_boost: multiplies({
    fr: "d'attaque de l'armée de défense",
    en: "Attack for Defending Army",
  }),
  defense_boost: multiplies({
    fr: "de défense de l'armée de défense",
    en: "Defense for Defending Army",
  }),
  military_boost: multiplies({
    fr: "d'attaque et de défense de l'armée d'attaque",
    en: "Attack and Defense for Attacking Army",
  }),
  fierce_resistance: multiplies({
    fr: "d'attaque et de défense de l'armée de défense",
    en: "Attack and Defense for Defending Army",
  }),
  clan_goods_extended: {
    fr: "Produit un peu de chaque ressource de l'ère précédente, actuelle et suivante pour la trésorerie de ta guilde. Ne se collecte qu'en étant membre d'une guilde.",
    en: "Produces some of each Good from the previous, current, and next Era for your Guild's Treasury. Can only be collected while you're in a Guild.",
  },
  contribution_boost_gold: {
    fr: "Augmente tes récompenses de contribution quand tu contribues aux niveaux or des Grands Monuments or des autres joueurs.",
    en: "Increases your contribution rewards when you contribute to Gold levels of other players' Gold Great Buildings.",
  },
  goods_production_boost: {
    fr: "Augmente d'un pourcentage les ressources produites par tes bâtiments.",
    en: "Increases the Goods produced by your buildings by a percentage.",
  },
  guild_raids_double_collection: {
    fr: "Pour tes premières collectes dans ta colonie des incursions quantiques, une chance que la collecte soit doublée. Hors hôtel de ville.",
    en: "For your first few collections in your Quantum Incursions settlement, there's a chance the collection is doubled. Excludes the Town Hall.",
  },
  helping_hands_boosted: {
    fr: "Ajoute une chance d'obtenir une meilleure récompense quand tu aides d'autres joueurs.",
    en: "Adds a chance of getting a better reward when you aid other players.",
  },
  military_ally_boost: {
    fr: "Renforce les alliés historiques militaires, comme s'ils gagnaient des niveaux. Peut faire dépasser le niveau 100.",
    en: "Enhances Military Historical Allies, the same as gaining extra levels. It can raise an ally's effective level past 100.",
  },
  science_ally_boost: {
    fr: "Renforce les alliés historiques scientifiques, comme s'ils gagnaient des niveaux. Peut faire dépasser le niveau 100.",
    en: "Enhances Science Historical Allies, the same as gaining extra levels. It can raise an ally's effective level past 100.",
  },
  missile_launch_wave_2: {
    fr: "Pour tes premiers combats, une chance de tuer la moitié des unités ennemies au début de la deuxième vague.",
    en: "For your first few battles, there's a chance to kill half the enemy units at the start of the second wave.",
  },
  second_strike: {
    fr: "Pour tes premiers combats, une chance de tuer une unité ennemie au début de la deuxième vague.",
    en: "For your first few battles, there's a chance to kill one enemy unit at the start of the second wave.",
  },
  special_goods_production_boost: {
    fr: "Augmente d'un pourcentage les ressources spéciales produites par tes bâtiments.",
    en: "Increases the Special Goods produced by your buildings by a percentage.",
  },
  spoils_of_war_enhanced: {
    fr: "Ajoute une chance d'obtenir une meilleure récompense quand tu gagnes des combats dans ta ville principale.",
    en: "Adds a chance of getting a better reward when you win fights in your main settlement.",
  },
}

export function bonusDescription(
  column: Pick<PrestigeColumn, "bonus" | "context">,
  locale: string,
): string | undefined {
  const lang = locale === "fr" ? "fr" : "en"
  const text = DESCRIPTIONS[column.bonus]?.[lang]
  return text?.replace("{place}", PLACES[column.context]?.[lang] ?? "")
}

// New effects of the Gold tier, once each
export function goldEffects(gb: Prestige): PrestigeColumn[] {
  const seen = new Set<string>()
  return gb.columns.filter((column) => {
    const key = `${column.bonus}/${column.context}`
    if (column.tier !== "gold" || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Wiki bonus of each game bonus, by the wiki's icon (".../icon_great_building_bonus_goods-<hash>.png"
// -> "goods", "att_def_boost_defender"), to show the copper bonuses in the wiki's order
const WIKI_ICONS: Record<string, string> = {
  advanced_tactics: "att_def_boost_attacker_defender",
  aid_boost: "aid_blueprints",
  aid_goods: "aid_goods",
  algorithmic_core: "algorithmic_core",
  clan_goods: "guild_goods",
  contribution_boost: "contribution_boost",
  critical_hit_chance: "critical_hit_chance",
  diplomatic_gifts: "diplomatic_gifts",
  double_collection: "double_collect",
  fierce_resistance: "att_def_boost_defender",
  first_strike: "first_strike",
  happiness: "happy",
  helping_hands: "helping_hands",
  medals: "medals",
  military_boost: "att_def_boost_attacker",
  missile_launch: "missile_launch",
  money: "coins",
  money_boost: "coins",
  mysterious_shards: "mysterious_shards",
  penal_unit: "penal_unit",
  plunder_and_pillage: "plunder_and_pillage",
  plunder_goods: "plunder_goods",
  plunder_repel: "plunder_repel",
  population: "population",
  previous_era_goods: "previous_era_good_production",
  quest_boost: "scroll",
  random_goods: "goods",
  special_goods: "special_goods",
  spoils_of_war: "spoils_of_war",
  strategy_points: "forgepoints",
  supplies: "supplies",
  supplies_boost: "supplies",
  totem_drop: "relic_hunt",
}

// Columns in the order of the wiki's bonuses (copper bonuses first, as the wiki lists them),
// Gold bonuses after in their own order
export function inWikiOrder(columns: PrestigeColumn[], wikiIcons: string[]): PrestigeColumn[] {
  const keys = wikiIcons.map((icon) =>
    (icon.split("/").pop() ?? "")
      .replace(/(-[0-9a-f]+)?\.\w+$/, "")
      .replace(/^icon_great_building_bonus_/, ""),
  )
  const rank = (column: PrestigeColumn) => {
    const wiki = WIKI_ICONS[column.bonus]
    const index = wiki ? keys.indexOf(wiki) : -1
    return column.tier === "gold" ? 2000 : index < 0 ? 1000 : index
  }
  return columns
    .map((column, index) => ({ column, index }))
    .sort((a, b) => rank(a.column) - rank(b.column) || a.index - b.index)
    .map(({ column }) => column)
}
