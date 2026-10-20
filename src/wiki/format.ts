import type { AgeBuilding } from "@/core/building"
import { EVENTS } from "@/core/events"
import { STATS, type StatDef, type StatKey } from "@/core/stats"
import { localized, type Locale, type Messages } from "@/lib/i18n"

export function formatNumber(value: number, locale: Locale, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)
}

// "198 %" for percent stats, "1 234" otherwise
export function formatStat(key: StatKey, value: number, locale: Locale, fractionDigits = 0) {
  const def: StatDef = STATS[key]
  const number = formatNumber(value, locale, fractionDigits)
  return def.unit === "percent" ? `${number} %` : number
}

// Short labels need their group outside the table: "Armée offensive · Cl. att"
const GROUPED_LABELS = new Set(["goods", "attacking_army", "defending_army", "quantum_incursions"])

export function longStatLabel(t: Messages, key: StatKey): string {
  const { group } = STATS[key] as StatDef
  return GROUPED_LABELS.has(group) ? `${t.statGroups[group]} · ${t.stats[key]}` : t.stats[key]
}

// Event family name, or its raw id when not named yet in src/core/events.ts
export function eventName(id: string, locale: Locale): string {
  return EVENTS[id] ? localized(EVENTS[id], locale) : id
}

// "Hiver 2025"
export function eventLabel(building: AgeBuilding, locale: Locale): string | undefined {
  if (!building.event) return undefined
  const name = eventName(building.event, locale)
  return building.eventYear ? `${name} ${building.eventYear}` : name
}

// "1 234 PF", "198 % Armée offensive · Cl. att", and boosts as "+10 % PF" (not "10 % +% PF")
export function statText(t: Messages, key: StatKey, value: number, locale: Locale, digits = 0) {
  const label = longStatLabel(t, key)
  if (label.includes("+% ")) {
    return `+${formatNumber(value, locale, digits)} % ${label.replace("+% ", "")}`
  }
  return `${formatStat(key, value, locale, digits)} ${label}`
}
