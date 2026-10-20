import { STATS, type StatDef, type StatKey } from "@/core/stats"
import type { Locale, Messages } from "@/lib/i18n"

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
