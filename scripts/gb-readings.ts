// Downloads Great Building bonuses beyond the wiki's last level (80) from FOE Assistant
// (foe-assistant.com, see NOTICE.md) into data/gb-readings.json, one page per Great
// Building, 2 s apart. Run it after the scraper: it matches its columns on data/great-buildings.
//   pnpm gb-readings
//
// Only bonuses that do not depend on the player's era are kept (chances, counts, boosts):
// production values beyond ~level 100 mix several eras on that site. Values that go down
// or jump are left out.

import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { GreatBuildingSchema, type GreatBuilding } from "../src/core/great-building"

const SITE = "https://foe-assistant.com"
const MAX_LEVEL = 400
const DELAY_MS = 2000
// Their names differ from the wiki's
const SLUG_ALIASES: Record<string, string> = { truce_tower: "Trust-Tower" }
// Depend on the player's era (or already exact from the wiki's progression)
const ERA_DEPENDENT = /production|happiness|population|guild goods|research/i

type SiteBonus = { name: string; main: Map<number, number>; extra: Map<number, number> }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const normalize = (name: string) =>
  name
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|\s/g, "")
    .replace(",", ".")

async function get(path: string): Promise<string> {
  const response = await fetch(`${SITE}${path}`, { headers: { "User-Agent": "FoE-Atlas" } })
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.text()
}

// Bonus tables of one Great Building (20 levels each, same columns):
// "98,08 <span>(23)</span>" gives 98.08 and 23
function parseBonuses(html: string): SiteBonus[] {
  const table = html.slice(html.indexOf('<table class="table table-striped'))
  const header = table.slice(0, table.indexOf("<tbody>"))
  const names = [...header.matchAll(/<a href="\/en\/b\/[^"]+">([^<]+)<\/a>/g)]
  const bonuses = names.map(([, name]) => ({ name, main: new Map(), extra: new Map() }))
  for (const [, row] of table.matchAll(/<tr class="text-right">(.*?)<\/tr>/gs)) {
    const level = Number(row.match(/<th scope="row">(\d+)/)?.[1])
    // Cost, owner cost, then value / increase / cost per unit for each bonus
    const cells = [...row.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(([, cell]) => cell)
    bonuses.forEach((bonus, index) => {
      const cell = cells[2 + index * 3]
      if (!cell) return
      const [main, extra] = [cell.replace(/<span.*<\/span>/s, ""), cell.match(/\(([^)]+)\)/)?.[1]]
      const value = Number(text(main))
      if (value) bonus.main.set(level, value)
      if (extra && Number(text(extra))) bonus.extra.set(level, Number(text(extra)))
    })
  }
  return bonuses
}

const wikiNumber = (value: string | undefined) =>
  value?.match(/^[\d,]+(\.\d+)?%?$/) ? Number(value.replace(/[,%]/g, "")) : undefined

// Same value as the wiki on (almost) every level from 1 to 80
function matches(series: Map<number, number>, wiki: Map<number, number>): boolean {
  const common = [...wiki.keys()].filter((level) => series.has(level))
  if (common.length < 40) return false
  const close = common.filter((level) => {
    const value = wiki.get(level)!
    return Math.abs(series.get(level)! - value) <= Math.max(0.011, 0.002 * Math.abs(value))
  })
  return close.length >= common.length * 0.95
}

// Levels beyond the wiki that keep going up at the pace of its last 40 levels: three times
// their average step per level, or their largest single step (counts go up by 1 now and then)
function plausible(series: Map<number, number>, wiki: Map<number, number>, gbLast: number) {
  const steps = Array.from(
    { length: 40 },
    (_, i) => (wiki.get(gbLast - i) ?? 0) - (wiki.get(gbLast - i - 1) ?? 0),
  )
  const pace =
    (Math.max(
      steps.reduce((sum, step) => sum + step, 0),
      0.4,
    ) /
      40) *
    3
  const largest = Math.max(...steps)
  const kept: Record<number, number> = {}
  let [lastLevel, lastValue] = [gbLast, wiki.get(gbLast) ?? 0]
  const rejected: number[] = []
  for (const level of [...series.keys()].filter((l) => l > gbLast).sort((a, b) => a - b)) {
    const value = series.get(level)!
    if (value >= lastValue && value - lastValue <= Math.max(pace * (level - lastLevel), largest)) {
      kept[level] = value
      ;[lastLevel, lastValue] = [level, value]
    } else rejected.push(level)
  }
  return { kept, rejected }
}

async function main() {
  const greatBuildings: GreatBuilding[] = readdirSync("data/great-buildings")
    .filter((file) => file.endsWith(".json"))
    .map((file) =>
      GreatBuildingSchema.parse(JSON.parse(readFileSync(`data/great-buildings/${file}`, "utf8"))),
    )
  const index = await get("/en/bonuses")
  const slugs = new Map(
    [...index.matchAll(/href="\/en\/gb\/([^/"]+)\/bonuses"/g)].map(([, slug]) => [
      normalize(slug),
      slug,
    ]),
  )

  const readings: Record<string, Record<string, Record<number, number>>> = {}
  for (const gb of greatBuildings) {
    const slug = SLUG_ALIASES[gb.id] ?? slugs.get(normalize(gb.name.en))
    if (!slug) {
      console.log(`${gb.id}: not on FOE Assistant`)
      continue
    }
    await sleep(DELAY_MS)
    const bonuses = parseBonuses(await get(`/en/gb/${slug}/bonuses/1,${MAX_LEVEL},90`))
    const gbLast = gb.levels.rows.at(-1)?.level ?? 0
    gb.levels.columns.forEach((column, index) => {
      if (ERA_DEPENDENT.test(column.label.en)) return
      const wiki = new Map(
        gb.levels.rows.flatMap((row) => {
          const value = wikiNumber(row.values[index])
          return value === undefined ? [] : [[row.level, value] as const]
        }),
      )
      const series = bonuses
        .flatMap((bonus) => [bonus.main, bonus.extra])
        .find((candidate) => matches(candidate, wiki))
      if (!series) return
      const { kept, rejected } = plausible(series, wiki, gbLast)
      const levels = Object.keys(kept).map(Number)
      if (!levels.length) return
      ;(readings[gb.id] ??= {})[column.label.en] = kept
      console.log(
        `${gb.id}: ${column.label.en}: ${levels.length} levels up to ${Math.max(...levels)}` +
          (rejected.length ? `, left out ${rejected.join(" ")}` : ""),
      )
    })
  }

  writeFileSync(
    "data/gb-readings.json",
    JSON.stringify({ source: SITE, downloadedAt: new Date().toISOString(), readings }, null, 2) +
      "\n",
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
