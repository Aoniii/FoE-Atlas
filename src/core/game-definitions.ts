// Reading of the game's building definitions (the CityEntities of a FoE Helper city export):
// values per age, size, road, chain and set links, as FoE Atlas buildings. Used by
// scripts/game-data.ts for the wiki and by the City tab for buildings missing from the wiki.
// Logic adapted from FoE Helper (js/web/citymap/js/parts/city-buildings.js, AGPL-3.0).

import { AGE_IDS, type AgeId } from "./ages"
import type { AgeData, BuildingType, Output, Reward, Road, StatBlock } from "./building"
import type { GameBuilding, GameLinks } from "./game-building"
import { chooseProduction } from "./production-choice"
import { ICON_PACKS, ICON_STATS } from "./resource-stats"
import type { StatKey } from "./stats"

// ---- Raw definitions (FoE Helper strips the "__class__" keys) ----

type Resources = Record<string, number>
type Boost = { type: string; value: number; targetedFeature?: string }
type Product = {
  type: string
  onlyWhenMotivated?: boolean
  playerResources?: { resources: Resources }
  guildResources?: { resources: Resources }
  reward?: { id: string; amount?: number; totalAmount?: number }
  products?: { product: Product; dropChance: number }[]
  unitTypeId?: string
  amount?: number
}
type LookupReward = {
  id?: string
  type?: string
  subType?: string
  amount?: number
  totalAmount?: number
  name?: string
}
type EraComponents = {
  chain?: { config?: { bonuses?: { productions?: Product[]; boosts?: Boost[] }[] } }
  production?: { options: { time?: number; products: Product[] }[] }
  boosts?: { boosts: Boost[] }
  happiness?: { provided?: number }
  staticResources?: { resources: { resources: Resources } }
  lookup?: { rewards: Record<string, LookupReward> }
}
type LinkPosition = {
  topLeftPoint: { x?: number; y?: number }
  bottomRightPoint: { x?: number; y?: number }
}
type Ability = {
  allowedPlacements?: { gridId: string }[]
  additionalResources?: Record<string, { resources: Resources }>
  boostHints?: { boostHintEraMap: Record<string, Boost> }[]
  rewards?: Record<
    string,
    {
      possible_rewards: {
        drop_chance: number
        reward: LookupReward & { possible_rewards?: { reward: LookupReward }[] }
      }[]
    }
  >
  chainId?: string
  linkPositions?: LinkPosition[]
  setId?: string
  bonuses?: {
    revenue?: Record<string, { resources: Resources }> | []
    boost?: Record<string, Boost> | []
  }[]
}
export type Definition = {
  id: string
  asset_id: string
  name: string
  type?: string
  width?: number
  length?: number
  is_special?: boolean
  provided_happiness?: number
  requirements?: {
    min_era?: string
    street_connection_level?: number
    cost?: { resources: Resources }
  }
  staticResources?: { resources: Resources }
  entity_levels?: {
    era?: string
    produced_money?: number
    provided_happiness?: number
    provided_population?: number
    production_values?: { type: string; value: number }[]
  }[]
  available_products?:
    { name?: string; production_time?: number; product?: { resources: Resources } }[] | null
  abilities?: Ability[]
  components?: Record<string, EraComponents> & {
    AllAge?: EraComponents & {
      placement?: { allowedPlacements?: { gridId: string }[]; size: { x: number; y: number } }
      streetConnectionRequirement?: { requiredLevel: number }
      chain?: {
        chainId: string
        linkPositions?: LinkPosition[]
        config?: { bonuses?: { productions?: Product[]; boosts?: Boost[] }[] }
      }
    }
  }
}

// ---- Which definitions are buildings of the main city ----

// Not buildings (roads, obstacles, off-grid features, settlements...) or rated apart
const SKIPPED_TYPES = new Set([
  "street",
  // Harbours outside the player's map (Arctic, Oceanic)
  "hub_main",
  "hub_part",
  "impediment",
  "off_grid",
  "outpost_ship",
  "friends_tavern",
  "diplomacy",
  "cultural_goods_production",
  "static_provider",
  "mission_item",
  "main_building",
  "greatbuilding",
  "stellar_capacity",
  "stellar_points",
])

function placements(def: Definition): string[] {
  const fromAbilities = (def.abilities ?? []).flatMap((a) => a.allowedPlacements ?? [])
  const fromComponents = def.components?.AllAge?.placement?.allowedPlacements ?? []
  return [...fromAbilities, ...fromComponents].map((p) => p.gridId)
}

export function isCityBuilding(def: Definition): boolean {
  if (!def.type || SKIPPED_TYPES.has(def.type)) return false
  // Test and stand-in definitions of the game
  if (/^Dummy\b/.test(def.name) || /Fake/.test(def.id)) return false
  const grids = placements(def)
  return grids.length === 0 || grids.includes("main")
}

// Type from the id prefix: event buildings are typed "residential" by the game
function buildingType(def: Definition): BuildingType {
  const [prefix, age] = def.id.split("_")
  if (def.components || def.is_special || /MultiAge|AllAge/.test(age ?? "")) return "special"
  const byPrefix: Record<string, BuildingType> = {
    R: "residential",
    P: "production",
    G: "goods",
    M: "military",
    A: "cultural",
    D: "decoration",
  }
  return byPrefix[prefix] ?? "special"
}

// ---- Values ----

// Game resource key -> stat ("random_good_of_age_1" is "random_good_of_age")
function resourceStat(key: string): StatKey | undefined {
  const base = key.replace(/_\d+$/, "")
  const stats = ICON_STATS[base]
  return stats?.length === 1 ? stats[0] : undefined
}

// Army boosts carry their context in the icon name ("att_boost_attacker_gbg")
const BOOST_CONTEXTS: Record<string, string> = {
  all: "",
  battleground: "_gbg",
  guild_expedition: "_gex",
  guild_raids: "_gr",
}
const BOOST_ALIASES: Record<string, string> = { happiness_amount: "happiness" }

function addBoost(passive: StatBlock, boost: Boost) {
  const type = BOOST_ALIASES[boost.type] ?? boost.type
  const isArmy = /_boost_/.test(type)
  const key = isArmy ? `${type}${BOOST_CONTEXTS[boost.targetedFeature ?? "all"] ?? ""}` : type
  for (const stat of ICON_STATS[key] ?? []) passive[stat] = (passive[stat] ?? 0) + boost.value
}

function resourceRewards(resources: Resources | unknown[] | undefined, guild = false): Reward[] {
  if (!resources || Array.isArray(resources)) return []
  return Object.entries(resources).flatMap(([key, amount]): Reward[] => {
    if (!amount) return []
    const stat: StatKey | undefined = guild
      ? /good/.test(key)
        ? "guild_goods"
        : undefined
      : resourceStat(key)
    return stat ? [{ type: "stat", stat, amount }] : []
  })
}

// Generic goods rewards: "goods#random#NextEra#30", "current_era_goods"...
function goodsStat(id: string): StatKey {
  if (/special_goods/.test(id)) return "special_goods"
  if (/NextEra|next_era/i.test(id)) return "goods_next"
  if (/PreviousEra|previous_era/i.test(id)) return "goods_prev"
  return "goods"
}

function lookupRewards(def: Definition, era: string): Record<string, LookupReward> {
  return { ...def.components?.AllAge?.lookup?.rewards, ...def.components?.[era]?.lookup?.rewards }
}

function genericReward(def: Definition, era: string, product: Product): Reward[] {
  const id = product.reward?.id ?? ""
  const lookup = lookupRewards(def, era)[id] ?? {}
  const amount =
    product.reward?.totalAmount ??
    product.reward?.amount ??
    lookup.totalAmount ??
    lookup.amount ??
    1
  if (lookup.type === "good" || (/goods/.test(id) && !/fragment|rush/.test(id))) {
    const fromId = Number(id.match(/(\d+)$/)?.[1])
    return [
      {
        type: "stat",
        stat: goodsStat(id),
        amount: lookup.totalAmount ?? lookup.amount ?? fromId ?? amount,
      },
    ]
  }
  // Unit chests: "genb_random_next_age_unit_chest10" holds 10 units
  if (lookup.type === "unit" || /random_(next_age_)?unit/.test(id)) {
    const units = Number(id.match(/chest(\d+)$/)?.[1] ?? lookup.name?.match(/(\d+)/)?.[1] ?? amount)
    return [{ type: "stat", stat: "units", amount: units }]
  }
  // Forge Point packages: their size is the subtype ("2", "5", "10")
  if (lookup.type === "forgepoint_package") {
    return [{ type: "stat", stat: "fp", amount: Number(lookup.subType) * amount }]
  }
  if (lookup.type === "resource" && lookup.subType) {
    const stat = resourceStat(lookup.subType)
    if (stat) return [{ type: "stat", stat, amount: lookup.amount ?? amount }]
  }
  const pack = ICON_PACKS[lookup.subType ?? ""]
  if (pack) return [{ type: "stat", stat: pack[0], amount: pack[1] * amount }]
  const name = (lookup.name ?? id).replace(/^\d+\s*/, "") || id
  return [{ type: "item", id, name: { fr: name, en: name }, amount: Math.max(amount, 1) }]
}

function productRewards(def: Definition, era: string, product: Product): Reward[] {
  switch (product.type) {
    case "resources":
      return resourceRewards(product.playerResources?.resources)
    case "guildResources":
      return resourceRewards(product.guildResources?.resources, true)
    case "genericReward":
    case "blueprint":
      return genericReward(def, era, product)
    case "unit":
      return [{ type: "stat", stat: "units", amount: product.amount ?? 1 }]
    default:
      return []
  }
}

function productOutput(def: Definition, era: string, product: Product): Output | undefined {
  const motivated = product.onlyWhenMotivated === true ? { motivated: true } : {}
  if (product.type === "random") {
    const options = (product.products ?? []).flatMap(({ product: option, dropChance }) => {
      const rewards = productRewards(def, era, option)
      const chance = Math.round(dropChance * 100 * 1000) / 1000
      return rewards.length && chance > 0 ? [{ chance: Math.min(chance, 100), rewards }] : []
    })
    return options.length ? { kind: "random", ...motivated, options } : undefined
  }
  const rewards = productRewards(def, era, product)
  return rewards.length ? { kind: "guaranteed", ...motivated, rewards } : undefined
}

// The 24h production option: the one lasting a day, else the first
function dailyOption<T extends { time?: number; production_time?: number }>(
  options: T[],
): T | undefined {
  return options.find((o) => (o.time ?? o.production_time) === 86400) ?? options[0]
}

// New format: components per age
function genericAge(def: Definition, era: string): AgeData {
  const components = def.components!
  const passive: StatBlock = {}
  for (const boost of [
    ...(components[era]?.boosts?.boosts ?? []),
    ...(components.AllAge?.boosts?.boosts ?? []),
  ]) {
    addBoost(passive, boost)
  }
  const happiness = components[era]?.happiness?.provided ?? components.AllAge?.happiness?.provided
  if (happiness) passive.happiness = happiness
  const population = (components[era] ?? components.AllAge)?.staticResources?.resources?.resources
    ?.population
  if (population) passive.population = population
  const production = components[era]?.production ?? components.AllAge?.production
  if (production && production.options.length > 1) {
    const choices = production.options.map((option) => ({
      time: option.time ?? 86400,
      rewards: option.products.flatMap((p) =>
        p.type === "random" ? [] : productRewards(def, era, p),
      ),
    }))
    return { passive, production: chooseProduction(choices) }
  }
  const option = production && dailyOption(production.options)
  const outputs = (option?.products ?? []).flatMap((p) => productOutput(def, era, p) ?? [])
  return { passive, production: outputs }
}

// Old format: entity levels per age, abilities, products
function legacyAge(def: Definition, era: string): AgeData {
  const passive: StatBlock = {}
  const level = def.entity_levels?.find((l) => l.era === era)
  const happiness = level?.provided_happiness ?? def.provided_happiness
  if (happiness) passive.happiness = happiness
  const population = level?.provided_population ?? def.staticResources?.resources?.population
  if (population) passive.population = population
  const production: Output[] = []
  if (level?.produced_money) {
    production.push({
      kind: "guaranteed",
      rewards: [{ type: "stat", stat: "coins", amount: level.produced_money }],
    })
  }
  for (const ability of def.abilities ?? []) {
    for (const hint of ability.boostHints ?? []) {
      const boost = hint.boostHintEraMap[era] ?? hint.boostHintEraMap.AllAge
      if (boost) addBoost(passive, boost)
    }
    const resources = {
      ...ability.additionalResources?.AllAge?.resources,
      ...ability.additionalResources?.[era]?.resources,
    }
    const rewards = resourceRewards(resources)
    if (rewards.length) production.push({ kind: "guaranteed", rewards })
    const chest = ability.rewards?.[era] ?? ability.rewards?.AllAge
    if (chest) {
      const options = chest.possible_rewards.flatMap(({ drop_chance, reward }) => {
        const amount =
          reward.possible_rewards?.[0]?.reward.amount ?? reward.totalAmount ?? reward.amount ?? 1
        const stat =
          reward.type === "good" || reward.type === "chest"
            ? goodsStat(reward.id ?? "")
            : reward.type === "guild_goods"
              ? "guild_goods"
              : resourceStat(reward.subType ?? "")
        const name = (reward.name ?? reward.id ?? "").replace(/^\d+\s*/, "")
        const rewardOut: Reward = stat
          ? { type: "stat", stat, amount }
          : {
              type: "item",
              id: reward.id ?? name,
              name: { fr: name, en: name },
              amount: Math.max(amount, 1),
            }
        return drop_chance > 0 ? [{ chance: drop_chance, rewards: [rewardOut] }] : []
      })
      if (options.length) production.push({ kind: "random", options })
    }
  }
  // Products to choose from (regular buildings, old special production buildings): amounts
  // are in the product, or per age in the level's production values, option by option
  const values = level?.production_values
  if (def.available_products?.length && (!def.is_special || values)) {
    const choices = def.available_products
      .filter((option) => option.name !== "Daily Bonus")
      .map((option, index) => {
        const value = values?.[index]
        const resources = value ? { [value.type]: value.value } : (option.product?.resources ?? {})
        const rewards = Object.entries(resources).flatMap(([key, amount]): Reward[] => {
          const stat = resourceStat(key) ?? (def.type === "goods" ? "goods" : undefined)
          return stat && amount ? [{ type: "stat", stat, amount }] : []
        })
        return { time: option.production_time || 86400, rewards }
      })
    production.push(...chooseProduction(choices))
  }
  return { passive, production }
}

// Ages a definition has values for: its own, or every age when it is the same everywhere
function definitionAges(def: Definition): AgeId[] {
  const isAge = (era: string | undefined): era is AgeId => AGE_IDS.includes(era as AgeId)
  if (def.components) {
    const ages = Object.keys(def.components).filter(isAge)
    return ages.length ? ages : [...AGE_IDS]
  }
  const levels = (def.entity_levels ?? []).map((l) => l.era).filter(isAge)
  if (levels.length) return levels
  const min = def.requirements?.min_era
  if (isAge(min)) return [min]
  return [...AGE_IDS]
}

function definitionAge(def: Definition, age: AgeId): AgeData {
  return def.components ? genericAge(def, age) : legacyAge(def, age)
}

// ---- Size, road, links ----

function size(def: Definition) {
  const placed = def.components?.AllAge?.placement?.size
  return { w: placed?.x ?? def.width ?? 1, h: placed?.y ?? def.length ?? 1 }
}

function road(def: Definition): Road {
  const level =
    def.requirements?.street_connection_level ??
    def.components?.AllAge?.streetConnectionRequirement?.requiredLevel ??
    0
  return level >= 2 ? "two_lane" : level === 1 ? "road" : "none"
}

// Where the next link of a chain attaches, relative to this building's top-left tile
function region(positions: LinkPosition[] | undefined) {
  const p = positions?.[0]
  if (!p) return undefined
  return {
    x1: p.topLeftPoint.x ?? 0,
    y1: p.topLeftPoint.y ?? 0,
    x2: p.bottomRightPoint.x ?? 0,
    y2: p.bottomRightPoint.y ?? 0,
  }
}

function links(def: Definition, ages: AgeId[]): GameLinks | undefined {
  const result: GameLinks = {}
  // Chains, new format
  const chain = def.components?.AllAge?.chain
  if (chain) {
    // Links carry a list of bonuses, even empty (a bridge adding nothing by itself)
    const isLink = Array.isArray(chain.config?.bonuses)
    const bonus = chain.config?.bonuses?.[0]
    result.chain = {
      id: chain.chainId,
      role: isLink ? "link" : "start",
      next: region(chain.linkPositions),
    }
    if (isLink) {
      // What a link adds can depend on the age: the chain of that age, else the common one
      result.chain.bonus = Object.fromEntries(
        ages.flatMap((age) => {
          const ageBonus = def.components?.[age]?.chain?.config?.bonuses?.[0] ?? bonus
          if (!ageBonus) return []
          const passive: StatBlock = {}
          for (const boost of ageBonus.boosts ?? []) addBoost(passive, boost)
          const production = (ageBonus.productions ?? []).flatMap(
            (p) => productOutput(def, age, p) ?? [],
          )
          return [[age, { passive, production }]]
        }),
      )
    }
  }
  for (const ability of def.abilities ?? []) {
    // Chains, old format
    if (ability.chainId && !result.chain) {
      const isLink = Array.isArray(ability.bonuses)
      result.chain = {
        id: ability.chainId,
        role: isLink ? "link" : "start",
        next: region(ability.linkPositions),
      }
      if (ability.bonuses?.length)
        result.chain.bonus = Object.fromEntries(
          ages.map((age) => [age, bonusAge(ability.bonuses![0], age)]),
        )
    }
    // Sets: one bonus per number of adjacent set buildings
    if (ability.setId) {
      result.set ??= { id: ability.setId }
      if (ability.bonuses?.length) {
        result.set.bonuses = Object.fromEntries(
          ages.map((age) => [age, ability.bonuses!.map((bonus) => bonusAge(bonus, age))]),
        )
      }
    }
  }
  return result.chain || result.set ? result : undefined
}

function bonusAge(bonus: NonNullable<Ability["bonuses"]>[number], age: AgeId): AgeData {
  const passive: StatBlock = {}
  const boost = Array.isArray(bonus.boost) ? undefined : (bonus.boost?.[age] ?? bonus.boost?.AllAge)
  if (boost) addBoost(passive, boost)
  const revenue = Array.isArray(bonus.revenue)
    ? undefined
    : (bonus.revenue?.[age] ?? bonus.revenue?.AllAge)
  const rewards = resourceRewards(revenue?.resources)
  return { passive, production: rewards.length ? [{ kind: "guaranteed", rewards }] : [] }
}

// A definition as a FoE Atlas building: every age it has values for, or only `onlyAges`
export function toGameBuilding(def: Definition, onlyAges?: AgeId[]): GameBuilding {
  const all = definitionAges(def)
  const ages = onlyAges ? all.filter((age) => onlyAges.includes(age)) : all
  const building: GameBuilding = {
    gameId: def.id,
    assetId: def.asset_id,
    name: def.name.replace(/\u00a0/g, " "),
    type: buildingType(def),
    size: size(def),
    road: road(def),
    ages: Object.fromEntries(ages.map((age) => [age, definitionAge(def, age)])),
  }
  const linked = links(def, ages)
  if (linked) building.links = linked
  return building
}
