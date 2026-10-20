import { AGES, type AgeId } from "../../src/core/ages"
import type { BuildingType } from "../../src/core/building"
import type { StatKey } from "../../src/core/stats"

// Army boost icons: "{att|def|att_def}_boost_{attacker|defender|attacker_defender}{_gbg|_gex|_gr|}"
// (gex = Guild Expeditions, gr = guild raids = Quantum Incursions)
function armyIcons(): Record<string, StatKey[]> {
  const kinds = { att: ["att"], def: ["def"], att_def: ["att", "def"] }
  const sides = { attacker: ["atk"], defender: ["def"], attacker_defender: ["atk", "def"] }
  const contexts = { "": "classic", _gbg: "gbg", _gex: "ge", _gr: "qi" }
  const icons: Record<string, StatKey[]> = {}
  for (const [kind, stats] of Object.entries(kinds)) {
    for (const [side, armies] of Object.entries(sides)) {
      for (const [suffix, context] of Object.entries(contexts)) {
        icons[`${kind}_boost_${side}${suffix}`] = armies.flatMap((army) =>
          stats.map((stat) => `${army}_army_${stat}_${context}` as StatKey),
        )
      }
    }
  }
  return icons
}

// Wiki icon file name (without hash) -> stats. Icons missing here are kept as
// items and listed in the report: add them here once identified.
export const ICON_STATS: Record<string, StatKey[]> = {
  strategy_points: ["fp"],
  forge_points_production: ["fp_boost"],
  all_goods_of_age: ["goods"],
  random_good_of_age: ["goods"],
  all_goods_of_previous_age: ["goods_prev"],
  random_good_of_previous_age: ["goods_prev"],
  all_goods_of_next_age: ["goods_next"],
  random_good_of_next_age: ["goods_next"],
  random_special_good_up_to_age: ["special_goods"],
  each_special_goods_up_to_age: ["special_goods"],
  guild_treasury: ["guild_goods"],
  goods_production: ["goods_boost"],
  guild_goods_production: ["guild_goods_boost"],
  guild_raids_supplies_production: ["qi_supplies_boost"],
  guild_raids_coins_production: ["qi_coins_boost"],
  money: ["coins"],
  coin_production: ["coins_boost"],
  supplies: ["supplies"],
  supply_production: ["supplies_boost"],
  medals: ["medals"],
  population: ["population"],
  happiness: ["happiness"],
  premium: ["diamonds"],
  military: ["units"],
  guild_raids_action_points_collection: ["qi_actions"],
  guild_raids_action_points_capacity: ["qi_actions_capacity"],
  guild_raids_coins_start: ["qi_coins"],
  guild_raids_supplies_start: ["qi_supplies"],
  guild_raids_goods_start: ["qi_goods"],
  guild_raids_units_start: ["qi_units"],
  ...armyIcons(),
}

// Icon shown next to each stat on the site: its own single-stat icon, or one of these
const EXTRA_STAT_ICONS: Partial<Record<StatKey, string>> = {
  guild_goods: "icon_great_building_bonus_guild_goods",
}

export function statIcons(urls: Map<string, string>): Partial<Record<StatKey, string>> {
  const icons: Partial<Record<StatKey, string>> = {}
  for (const [stat, icon] of Object.entries(EXTRA_STAT_ICONS)) {
    const url = urls.get(icon)
    if (url) icons[stat as StatKey] = url
  }
  for (const [icon, stats] of Object.entries(ICON_STATS)) {
    const url = urls.get(icon)
    if (url && stats.length === 1 && !icons[stats[0]]) icons[stats[0]] = url
  }
  return icons
}

// Specific unit icons ("armyuniticons_90x90_rogue") all count as units
export function iconStats(icon: string): StatKey[] | undefined {
  return ICON_STATS[icon] ?? (icon.startsWith("armyuniticons_") ? ["units"] : undefined)
}

// Packages worth a fixed amount of a stat. To verify in game.
export const ICON_PACKS: Record<string, [StatKey, number]> = {
  small_forgepoints: ["fp", 2],
  medium_forgepoints: ["fp", 5],
  large_forgepoints: ["fp", 10],
}

// Real items, shown as such (not reported as unknown)
export const KNOWN_ITEMS = new Set([
  "blueprint",
  "blueprint_box",
  "icon_fragment",
  "renovation_kit",
  "one_up_kit",
  "motivate_one",
  "boost_coins_large",
  "large_supplies",
  "large_medals",
  "xlarge_medals",
  "rush_mass_coins_medium",
  "rush_single_event_building_instant",
  "buccaneer",
  "dead_man_stash",
  "reward_random",
  "medal_production",
  "special_goods_production",
])

// Icons that carry no building value (ranking points, durations, sizes...)
export const IGNORED_ICONS = new Set(["rank", "time", "size", "street"])

export function ageFromLabel(label: string): AgeId | undefined {
  const normalized = label.trim().toLowerCase()
  return AGES.find((age) => age.name.en.toLowerCase() === normalized)?.id
}

// Building type from the image asset id prefix. To verify against real data.
export function typeFromId(id: string): BuildingType {
  if (id.startsWith("X_")) return "great_building"
  if (/MultiAge|_SS_/.test(id)) return "special"
  const byPrefix: Record<string, BuildingType> = {
    R: "residential",
    P: "production",
    G: "goods",
    M: "military",
    Z: "cultural",
    D: "decoration",
  }
  return byPrefix[id[0]] ?? "special"
}
