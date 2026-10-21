// Great Buildings on the beta server (prestige rework, data/gb-beta.json from foebeta.com):
// bonuses unlock by tier (copper, then silver, then gold) and levels go up to 400.

import { z } from "zod"

export const BetaTierSchema = z.enum(["copper", "silver", "gold"])
export type BetaTier = z.infer<typeof BetaTierSchema>

// "2 x 27%": count 2, value 27
export const BetaValueSchema = z.object({ count: z.number().optional(), value: z.number() })
export type BetaValue = z.infer<typeof BetaValueSchema>

export const BetaColumnSchema = z.object({
  // English names from the beta ("clan goods", "all"), see BETA_BONUSES
  bonus: z.string(),
  context: z.string(),
  tier: BetaTierSchema,
  percent: z.boolean(),
})
export type BetaColumn = z.infer<typeof BetaColumnSchema>

export const BetaGreatBuildingSchema = z.object({
  maxLevel: z.number().int().positive(),
  columns: z.array(BetaColumnSchema),
  // One row per level: FP cost, then one value per column (null before its tier unlocks)
  rows: z.array(
    z.object({
      level: z.number().int().positive(),
      cost: z.number(),
      values: z.array(BetaValueSchema.nullable()),
    }),
  ),
})
export type BetaGreatBuilding = z.infer<typeof BetaGreatBuildingSchema>

// Max level: 200 with copper bonuses only, otherwise the last level a bonus still goes up
export const COPPER_MAX_LEVEL = 200

export function betaMaxLevel(columns: BetaColumn[], rows: BetaGreatBuilding["rows"]): number {
  if (columns.every((column) => column.tier === "copper")) return COPPER_MAX_LEVEL
  const key = (value: BetaValue | null) => (value ? `${value.count}x${value.value}` : "")
  let last = 0
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].values.some((value, index) => key(value) !== key(rows[i - 1].values[index]))) {
      last = rows[i].level
    }
  }
  return Math.max(COPPER_MAX_LEVEL, last)
}

type Localized = { fr: string; en: string }

// Bonus names of the beta, in the words of the rest of the site
export const BETA_BONUSES: Record<string, Localized> = {
  "advanced tactics": { fr: "Tactiques avancées", en: "Advanced Tactics" },
  "aid boost": { fr: "Bonus d'entraide", en: "Aid Boost" },
  "aid goods": { fr: "Ressources d'entraide", en: "Aid Goods" },
  "algorithmic core": { fr: "Noyau algorithmique", en: "Algorithmic Core" },
  "attack boost": { fr: "Attaquants - Attaque", en: "Attackers - Attack" },
  "attacker defense boost": { fr: "Attaquants - Défense", en: "Attackers - Defense" },
  "clan goods": { fr: "Ressources de la guilde", en: "Guild Goods" },
  "contribution boost": { fr: "Bonus de contribution", en: "Contribution Boost" },
  "contribution boost gold": { fr: "Bonus de contribution (or)", en: "Contribution Boost (gold)" },
  "critical hit chance": { fr: "Coup critique", en: "Critical Hit" },
  "defender attack boost": { fr: "Défenseurs - Attaque", en: "Defenders - Attack" },
  "defense boost": { fr: "Défenseurs - Défense", en: "Defenders - Defense" },
  "diplomatic gifts": { fr: "Cadeaux diplomatiques", en: "Diplomatic Gifts" },
  "double collection": { fr: "Collecte doublée", en: "Double Collection" },
  "fierce resistance": { fr: "Résistance acharnée", en: "Fierce Resistance" },
  "first strike": { fr: "Première frappe", en: "First Strike" },
  happiness: { fr: "Satisfaction", en: "Happiness" },
  "helping hands": { fr: "Aide entre joueurs", en: "Helping Hands" },
  medals: { fr: "Médailles", en: "Medals" },
  "military boost": { fr: "Bonus militaire", en: "Military Boost" },
  "missile launch": { fr: "Lancement de missile", en: "Missile Launch" },
  money: { fr: "Pièces", en: "Coins" },
  "money boost": { fr: "Bonus pièces", en: "Coin Boost" },
  "mysterious shards": { fr: "Éclats mystérieux", en: "Mysterious Shards" },
  "mysterious shards: rare": { fr: "Éclats mystérieux : rares", en: "Mysterious Shards: rare" },
  "penal unit": { fr: "Unité pénitentiaire", en: "Penal Unit" },
  "plunder and pillage": { fr: "Pillage et saccage", en: "Plunder and Pillage" },
  "plunder goods": { fr: "Ressources de pillage", en: "Plunder Goods" },
  "plunder repel": { fr: "Résistance au pillage", en: "Plunder Repel" },
  population: { fr: "Population", en: "Population" },
  "previous era goods": { fr: "Ressources de l'ère précédente", en: "Previous Era Goods" },
  "quest boost": { fr: "Bonus de récompense de quête", en: "Quest Reward Boost" },
  "random goods": { fr: "Ressources", en: "Goods" },
  "special goods": { fr: "Ressources spéciales", en: "Special Goods" },
  "strategy points": { fr: "Points Forge", en: "Forge Points" },
  supplies: { fr: "Marchandises", en: "Supplies" },
  "supplies boost": { fr: "Amélioration marchandises", en: "Supply Boost" },
  "totem drop": { fr: "Chasse à la relique", en: "Relic Hunt" },
  "totem drop: rare": { fr: "Chasse à la relique : rares", en: "Relic Hunt: rare" },
}

// Where the bonus applies; nothing for "all"
export const BETA_CONTEXTS: Record<string, Localized> = {
  battleground: { fr: "CBG", en: "GBG" },
  "guild expedition": { fr: "EG", en: "GE" },
  "guild raids": { fr: "IQ", en: "QI" },
}

// "Défenseurs - Attaque (CBG)"; unknown names as written on the beta
export function betaLabel(column: BetaColumn, locale: string): string {
  const lang = locale === "fr" ? "fr" : "en"
  const name = BETA_BONUSES[column.bonus]?.[lang] ?? column.bonus
  const context = BETA_CONTEXTS[column.context]?.[lang]
  return context ? `${name} (${context})` : name
}
