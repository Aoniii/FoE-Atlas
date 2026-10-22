import { AGES, type AgeId } from "../../src/core/ages"
import type { BuildingType } from "../../src/core/building"
import type { StatKey } from "../../src/core/stats"

export { ICON_PACKS, ICON_STATS } from "../../src/core/resource-stats"
import { ICON_STATS } from "../../src/core/resource-stats"

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
