import type { AgeBuilding } from "@/core/building"
import { DEFAULT_BOOST_BASES, DEFAULT_REFERENCES, type BoostBases } from "@/core/efficiency"
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

// Full name, without abbreviations ("Terminer une production spéciale (FSP)")
export function fullStatLabel(t: Messages, key: StatKey): string {
  return t.statsFull[key]
}

// Lines explaining what a stat is worth in the score:
// "1 point = 12 % par case", and for boosts "+1 % compte comme 20 PF" first
export function scoreHint(
  t: Messages,
  key: StatKey,
  locale: Locale,
  bases: BoostBases = DEFAULT_BOOST_BASES,
): string[] {
  const def: StatDef = STATS[key]
  const fill = (template: string, value: string) => template.replace("{value}", value)
  if (def.boosts) {
    const base = def.boosts as StatKey
    const equivalent = bases[def.boosts] / 100
    const reference = DEFAULT_REFERENCES[base]
    const lines = [fill(t.wiki.tooltipBoost, statText(t, base, equivalent, locale))]
    if (reference && equivalent > 0) {
      const perPoint = `${formatNumber(reference / equivalent, locale, 3)} %`
      lines.push(fill(t.wiki.tooltipPoint, perPoint))
    }
    return lines
  }
  const reference = DEFAULT_REFERENCES[key]
  return reference ? [fill(t.wiki.tooltipPoint, formatStat(key, reference, locale, 2))] : []
}

// Score color along the rainbow: violet at 0, then red, orange, yellow, green,
// blue from 10 on. Hue stops are interpolated (hues above 360 wrap around)
const SCORE_HUES: [score: number, hue: number][] = [
  [0, 280],
  [2, 360],
  [4, 390],
  [6, 415],
  [8, 490],
  [10, 580],
]

// HSL -> sRGB channels in 0..1
function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const a = saturation * Math.min(lightness, 1 - lightness)
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12
    return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [channel(0), channel(8), channel(4)]
}

// WCAG relative luminance
function luminance([r, g, b]: [number, number, number]): number {
  const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

const contrast = (l1: number, l2: number) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)

// Background along the rainbow, and black or white text, whichever contrasts most
export function scoreColor(score: number): { background: string; foreground: string } {
  const s = Math.min(Math.max(score, 0), 10)
  const i = SCORE_HUES.findIndex(([stop]) => stop >= s)
  const [s1, h1] = SCORE_HUES[Math.max(i - 1, 0)]
  const [s2, h2] = SCORE_HUES[i]
  const hue = Math.round((s2 === s1 ? h2 : h1 + ((s - s1) / (s2 - s1)) * (h2 - h1)) % 360)
  const background = luminance(hslToRgb(hue, 0.75, 0.5))
  const dark = contrast(background, 0) >= contrast(background, 1)
  return {
    background: `hsl(${hue} 75% 50%)`,
    foreground: dark ? "#000" : "#fff",
  }
}

// Wiki values are English-formatted text ("1,100", "12.5%"): reformat numbers for the locale
export function formatValue(value: string | undefined, locale: Locale): string {
  if (!value) return "–"
  const match = value.match(/^([\d,]+(?:\.\d+)?)(\s*%)?$/)
  if (!match) return value
  const number = formatNumber(Number(match[1].replace(/,/g, "")), locale, 2)
  return match[2] ? `${number} %` : number
}
