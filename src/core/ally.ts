// Historical allies: characters placed in a building's room, with a rarity (common to
// legendary) and a level (1 to 100). Each rarity adds its boosts, production and limited
// bonuses to the earlier ones', and every value grows with the level. From the game's own
// definitions and the official wiki (scripts/allies.ts, data/allies.json).

import type { LocalizedName } from "./game-item"

export const ALLY_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const
export type AllyRarity = (typeof ALLY_RARITIES)[number]
export const ALLY_MAX_LEVEL = 100

// "att_boost_attacker" in "battleground" (Guild Battlegrounds), "guild_expedition", or
// "all"; values in % by level (values[0]: level 1)
export type AllyBoost = { type: string; feature: string; icon?: string; values: number[] }

// What it adds to its building's production, by level: Forge Points, goods of the age (or
// the previous, the next one), units of a class from the age (or the next one)
export type AllyProduction = {
  kind: "fp" | "goods" | "goods_prev" | "goods_next" | "unit"
  unitClass?: string
  nextEra?: boolean
  icon?: string
  amounts: number[]
}

// "17 % chance to grant Frenzy to 200 light units in Guild Battlegrounds": chance and units
// by level
export type AllyAbility = {
  ability: string
  name: LocalizedName
  unitClass: string
  feature: string
  icon?: string
  chances: number[]
  charges: number[]
}

export type AllyRarityInfo = {
  rarity: AllyRarity
  boosts: AllyBoost[]
  production: AllyProduction[]
  abilities: AllyAbility[]
  // Valor Tokens and Heroic Scrolls to evolve, Valor Tokens back when disbanded
  evolution: { valor?: number; scrolls?: number }
  disband?: number
}

export type Ally = {
  id: string
  name: LocalizedName
  description: LocalizedName
  type: "military" | "science"
  image?: string
  sourceUrl?: string
  // Heroic Scrolls to reach each level (levelCosts[0]: level 1)
  levelCosts: number[]
  rarities: AllyRarityInfo[]
}

// Ally grid (public/data/allies.json)
export type AllyCard = Pick<Ally, "id" | "name" | "type" | "image">

// Value at a level (1-based), the last one past the end
export const atLevel = (values: number[], level: number) =>
  values[Math.min(level, values.length) - 1] ?? 0

// Rarities an ally has at a rarity: that one and the ones before
export const raritiesUpTo = (ally: Ally, rarity: AllyRarity) =>
  ally.rarities.filter((r) => ALLY_RARITIES.indexOf(r.rarity) <= ALLY_RARITIES.indexOf(rarity))
