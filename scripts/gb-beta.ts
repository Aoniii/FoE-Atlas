// Downloads the Great Buildings of the beta server (prestige rework: copper, silver and gold
// bonuses, up to level 400) from foebeta.com (see NOTICE.md) into data/gb-beta.json, one page
// per Great Building, 3 s apart. Pages are cached in scripts/.cache/gb-beta.
//   pnpm gb-beta            download what is not cached yet
//   pnpm gb-beta --refresh  download everything again

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import {
  betaMaxLevel,
  type BetaColumn,
  type BetaGreatBuilding,
  type BetaTier,
  type BetaValue,
} from "../src/core/gb-beta"

const SITE = "https://foebeta.com"
const PAGE = "/featured/great-buildings/"
const CACHE = "scripts/.cache/gb-beta"
const DELAY_MS = 3000
const RETRIES = 3
// Their ids differ from ours
const ID_ALIASES: Record<string, string> = {
  ai_core: "a_i_core",
  habitat_67: "the_habitat",
  himeji: "himeji_castle",
  kraken: "the_kraken",
  rainforest_project: "rain_forest_project",
  saint_basils_cathedral: "saint_basil_s_cathedral",
  virgo_project: "the_virgo_project",
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const decode = (text: string) =>
  text
    .replace(/<[^>]+>/g, "")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim()
// Thousands with dots or commas ("2.500.085", "1,714"), decimals otherwise ("1,5", "0.5")
const number = (text: string) =>
  /^\d{1,3}([.,]\d{3})+$/.test(text)
    ? Number(text.replace(/[.,]/g, ""))
    : Number(text.replace(",", "."))

async function get(path: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${SITE}${path}`, { headers: { "User-Agent": "FoE-Atlas" } })
    if (response.ok) return response.text()
    if (attempt === RETRIES) throw new Error(`${path}: HTTP ${response.status}`)
    console.log(`${path}: HTTP ${response.status}, retrying`)
    await sleep(DELAY_MS * 5 * attempt)
  }
}

function parse(html: string): BetaGreatBuilding {
  const start = html.indexOf('id="staticLevelsTable"')
  if (start === -1) throw new Error("Levels table not found: foebeta.com changed")
  const table = html.slice(start, html.indexOf("</table>", start))
  const [head, body] = table.split("<tbody")
  // Bonus columns, every one after level, FP and rank: "clan goods (all) [Tier: copper]" in
  // the title or in the icon's file name, depending on the column. A column without a tier
  // ("Rare") details the one before it. Other costs than FP ("Required" goods...) are skipped.
  const columns: BetaColumn[] = []
  // Position of each bonus column among the cells of a row
  const cellIndex: number[] = []
  const ths = head.split("<th").filter((th) => th.includes("data-col-key"))
  for (const [position, th] of ths.entries()) {
    const key = th.match(/data-col-key="([^"]+)"/)![1]
    const title = decode(th.match(/title="([^"]*)"/)?.[1] ?? "")
    if (["level", "fp", "rank"].includes(key) || title === "Required") continue
    cellIndex.push(position)
    const icon = decodeURIComponent(th.match(/src="[^"]*\/([^"/]+)\.png"/)?.[1] ?? "")
    const match = [title, icon]
      .map((name) => name.match(/^(.*?)\s*\(([^)]*)\)\s*\[Tier:?\s*(\w+)\]$/))
      .find(Boolean)
    const previous = columns.at(-1)
    if (match) {
      const [, bonus, context, tier] = match
      columns.push({
        bonus: bonus.toLowerCase(),
        context: context.toLowerCase(),
        tier: tier.toLowerCase() as BetaTier,
        percent: false,
      })
    } else if (previous && title) {
      columns.push({ ...previous, bonus: `${previous.bonus}: ${title.toLowerCase()}` })
    } else throw new Error(`Unexpected column: ${title} / ${icon}`)
  }
  const rows = [...body.matchAll(/<tr>(.*?)<\/tr>/gs)].map(([, row]) => {
    const cells = [...row.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(([, cell]) => decode(cell))
    return {
      level: Number(cells[0].replace("#", "")),
      cost: number(cells[1]),
      // One cell per bonus: "-", "35", "21%" or "2 x 27%"
      values: columns.map((column, index): BetaValue | null => {
        const cell = cells[cellIndex[index]] ?? "-"
        const match = cell.match(/^(?:([\d.,]+)\s*x\s*)?([\d.,]+)\s*(%?)$/)
        if (!match) return null
        if (match[3]) column.percent = true
        return match[1]
          ? { count: number(match[1]), value: number(match[2]) }
          : { value: number(match[2]) }
      }),
    }
  })
  const maxLevel = betaMaxLevel(columns, rows)
  return { maxLevel, columns, rows: rows.filter((row) => row.level <= maxLevel) }
}

async function page(slug: string, refresh: boolean): Promise<string> {
  const file = `${CACHE}/${slug}.html`
  if (!refresh && existsSync(file)) return readFileSync(file, "utf8")
  await sleep(DELAY_MS)
  const html = await get(`${PAGE}?gb=${slug}`)
  // Some links show the directory instead of the building: not cached, tried again next time
  if (html.includes('id="staticLevelsTable"')) writeFileSync(file, html)
  return html
}

async function main() {
  const refresh = process.argv.includes("--refresh")
  mkdirSync(CACHE, { recursive: true })
  const ours = new Set(
    readdirSync("data/great-buildings")
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(readFileSync(`data/great-buildings/${file}`, "utf8")).id),
  )
  const directory = await get(PAGE)
  const slugs = [...new Set([...directory.matchAll(/\?gb=([a-z0-9_]+)/g)].map(([, slug]) => slug))]

  const buildings: Record<string, BetaGreatBuilding> = {}
  for (const slug of slugs) {
    const id = ID_ALIASES[slug] ?? slug
    if (!ours.has(id)) {
      console.log(`${slug}: no Great Building ${id} in data/great-buildings`)
      continue
    }
    const html = await page(slug, refresh)
    if (!html.includes('id="staticLevelsTable"')) {
      console.log(`${slug}: no level table on foebeta.com, skipped`)
      continue
    }
    const building = parse(html)
    if (!building.columns.length) throw new Error(`${slug}: no bonus found`)
    buildings[id] = building
    const tiers = [...new Set(building.columns.map((column) => column.tier))].join("/")
    console.log(
      `${id}: ${building.columns.length} bonuses (${tiers}), max level ${building.maxLevel}`,
    )
  }

  writeFileSync(
    "data/gb-beta.json",
    JSON.stringify({
      source: `${SITE}${PAGE}`,
      downloadedAt: new Date().toISOString(),
      buildings,
    }) + "\n",
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
