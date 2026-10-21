// Great Buildings on the beta server (prestige rework), from the game's own data
// (data/gb-beta.json, see scripts/gb-beta.ts). Copper bonuses grow from level 1 to 200, Gold
// bonuses from level 101 to 500. The game only sends each bonus's exact value at milestone
// levels (1, 101, 201, 301, 401, 500): levels in between follow one shared curve, measured on
// ~300 values read in game (exact for 4 values out of 5, within 0.5% otherwise).

import { z } from "zod"

export const BetaTierSchema = z.enum(["copper", "gold"])
export type BetaTier = z.infer<typeof BetaTierSchema>

// "6 x 64%": count 6 (charges, units...), value 64
export const BetaValueSchema = z.object({ count: z.number().optional(), value: z.number() })
export type BetaValue = z.infer<typeof BetaValueSchema>

export const BetaColumnSchema = z.object({
  // Game names ("clan_goods", "guild_expedition"), see BETA_BONUSES
  bonus: z.string(),
  context: z.string(),
  tier: BetaTierSchema,
  percent: z.boolean(),
  // File in public/beta-icons/, from the game's icon sheet
  icon: z.string().optional(),
  // Exact values at the milestone levels, in level order
  milestones: z.array(
    z.object({ level: z.number().int().positive() }).extend(BetaValueSchema.shape),
  ),
})
export type BetaColumn = z.infer<typeof BetaColumnSchema>

export const BetaGreatBuildingSchema = z.object({
  maxLevel: z.number().int().positive(),
  // FP cost of level 1 (levels 1 to 10 cost 1x to 10x that)
  firstLevelCost: z.number().positive(),
  columns: z.array(BetaColumnSchema),
})
export type BetaGreatBuilding = z.infer<typeof BetaGreatBuildingSchema>

export const COPPER_MAX_LEVEL = 200
export const GOLD_FIRST_LEVEL = 101
export const GOLD_MAX_LEVEL = 500

// Share of a tier's growth reached at each 5% of its levels (copper 1-200, gold 101-500)
const CURVE = [
  0, 0.099, 0.2087, 0.3174, 0.4157, 0.5061, 0.5845, 0.653, 0.7135, 0.7627, 0.8091, 0.8466, 0.8785,
  0.9056, 0.9268, 0.9457, 0.9611, 0.9741, 0.9841, 0.9928, 1,
]

function curve(x: number): number {
  const position = Math.min(Math.max(x, 0), 1) * (CURVE.length - 1)
  const index = Math.min(Math.floor(position), CURVE.length - 2)
  return CURVE[index] + (CURVE[index + 1] - CURVE[index]) * (position - index)
}

// Position of a level along its tier's growth
function tierPosition(tier: BetaTier, level: number): number {
  return tier === "copper"
    ? (level - 1) / (COPPER_MAX_LEVEL - 1)
    : (level - GOLD_FIRST_LEVEL) / (GOLD_MAX_LEVEL - GOLD_FIRST_LEVEL)
}

// Value of a bonus at a level: exact on milestones, along the shared curve in between;
// null while its tier is locked
export function betaValueAt(column: BetaColumn, level: number): BetaValue | null {
  if (column.tier === "gold" && level < GOLD_FIRST_LEVEL) return null
  // Copper stops growing at 200 (its next milestone, 201, holds the same value)
  const end = column.tier === "copper" ? COPPER_MAX_LEVEL : GOLD_MAX_LEVEL
  const start = column.tier === "copper" ? 1 : GOLD_FIRST_LEVEL
  const points = column.milestones
    .filter((m) => m.level >= start)
    .map((m) => ({ ...m, level: Math.min(m.level, end) }))
  const next = points.findIndex((m) => m.level >= level)
  if (next <= 0) {
    const m = points[next === 0 ? 0 : points.length - 1]
    return { value: m.value, ...(m.count !== undefined && { count: m.count }) }
  }
  const [a, b] = [points[next - 1], points[next]]
  const [ga, gb, gl] = [a.level, b.level, level].map((l) => curve(tierPosition(column.tier, l)))
  const share = gb > ga ? (gl - ga) / (gb - ga) : 0
  const between = (from: number, to: number) => Math.round(from + (to - from) * share)
  return {
    value: between(a.value, b.value),
    ...(a.count !== undefined && b.count !== undefined && { count: between(a.count, b.count) }),
  }
}

// Level cost, approximate (within ~3% up to level 260 for Gold buildings, ~15% for
// copper-only ones past 101): scaled on the level 1 cost up to 101, then a shared part per
// tier grows by the level. Past 260 (no reading there), Gold costs grow 1.65% a level: the
// total to level 500 then matches the official ~755.8M FP.
const COST_SHAPE: [level: number, times: number][] = [
  [10, 10],
  [11, 10.47],
  [18, 13.8],
  [26, 17.61],
  [32, 20.62],
  [51, 32.69],
  [63, 42],
  [67, 45.07],
  [83, 72.16],
  [101, 108.66],
]
const COST_STEP = { copper: 1134, gold: 1443 }
const COST_READ_UP_TO = 260
const COST_GROWTH = 1.0165

export function betaCostAt(gb: BetaGreatBuilding, level: number): number {
  const gold = gb.maxLevel > COPPER_MAX_LEVEL
  if (level <= 10) return gb.firstLevelCost * level
  if (level <= 101) {
    const next = COST_SHAPE.findIndex(([l]) => l >= level)
    const [[l0, t0], [l1, t1]] = [COST_SHAPE[next - 1], COST_SHAPE[next]]
    return Math.round(gb.firstLevelCost * (t0 + ((t1 - t0) * (level - l0)) / (l1 - l0)))
  }
  const linear = (l: number) =>
    gb.firstLevelCost * 108.66 + COST_STEP[gold ? "gold" : "copper"] * (l - 101)
  if (gold && level > COST_READ_UP_TO) {
    return Math.round(linear(COST_READ_UP_TO) * COST_GROWTH ** (level - COST_READ_UP_TO))
  }
  return Math.round(linear(level))
}

type Localized = { fr: string; en: string }

// Bonus names of the game, in the words of the rest of the site
export const BETA_BONUSES: Record<string, Localized> = {
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
export const BETA_CONTEXTS: Record<string, Localized> = {
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
const isMultiplier = (column: Pick<BetaColumn, "bonus" | "context">) =>
  MULTIPLIERS.has(column.bonus) ||
  (["military_boost", "fierce_resistance"].includes(column.bonus) && column.context !== "all")

// "Défenseurs - Attaque et défense (multiplicateur, CBG)"; unknown names as sent by the game
export function betaLabel(column: Pick<BetaColumn, "bonus" | "context">, locale: string): string {
  const lang = locale === "fr" ? "fr" : "en"
  const name = BETA_BONUSES[column.bonus]?.[lang] ?? column.bonus.replace(/_/g, " ")
  const details = [
    isMultiplier(column) && (lang === "fr" ? "multiplicateur" : "multiplier"),
    BETA_CONTEXTS[column.context]?.[lang],
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

export function betaDescription(
  column: Pick<BetaColumn, "bonus" | "context">,
  locale: string,
): string | undefined {
  const lang = locale === "fr" ? "fr" : "en"
  const text = DESCRIPTIONS[column.bonus]?.[lang]
  return text?.replace("{place}", PLACES[column.context]?.[lang] ?? "")
}

// New effects of the Gold tier, once each
export function betaGoldEffects(gb: BetaGreatBuilding): BetaColumn[] {
  const seen = new Set<string>()
  return gb.columns.filter((column) => {
    const key = `${column.bonus}/${column.context}`
    if (column.tier !== "gold" || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
