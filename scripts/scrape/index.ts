// Scrapes the official FoE wiki into data/buildings/<id>.json
//
//   make scraper                              full run (asks for the game version)
//   make scraper ARGS="--limit 10"            sample: first 10 buildings found
//   make scraper ARGS="--offline"             re-parse the local cache, no request
//   make scraper GAME_VERSION=1.312           game version without prompt
//
// The last game version is kept in .env: leaving the prompt empty reuses it.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { createInterface } from "node:readline/promises"
import { parseArgs, parseEnv } from "node:util"
import { z } from "zod"
import { BuildingSchema, LocalizedSchema, type Building } from "../../src/core/building"
import { eventFromAsset } from "./events"
import { statIcons, typeFromId } from "./mappings"
import {
  buildingIdFromUrl,
  collectIconUrls,
  isBuildingPage,
  parseBuildingPage,
  type Issue,
  type ParsedBuilding,
} from "./parse"
import { WikiClient, syncPages } from "./wiki"

// Overridable to test against a local fake wiki
const WIKIS = {
  en: process.env.WIKI_EN ?? "https://en.wiki.forgeofempires.com",
  fr: process.env.WIKI_FR ?? "https://fr.wiki.forgeofempires.com",
}
const CACHE_DIR = "scripts/.cache"
const DATA_DIR = "data/buildings"
const ENV_FILE = ".env"
// Hand-written corrections applied on top of the wiki, kept across runs
const OVERRIDES_FILE = "scripts/scrape/overrides.json"

const OverridesSchema = z.record(
  z.string(),
  z.strictObject({ name: LocalizedSchema.partial().optional(), event: z.string().optional() }),
)

function loadOverrides(): z.infer<typeof OverridesSchema> {
  if (!existsSync(OVERRIDES_FILE)) return {}
  return OverridesSchema.parse(JSON.parse(readFileSync(OVERRIDES_FILE, "utf8")))
}

const { values: args } = parseArgs({
  options: {
    limit: { type: "string" },
    offline: { type: "boolean", default: false },
    "game-version": { type: "string" },
  },
})
const limit = args.limit ? Number(args.limit) : undefined

function storedGameVersion(): string | null {
  if (!existsSync(ENV_FILE)) return null
  return parseEnv(readFileSync(ENV_FILE, "utf8")).GAME_VERSION || null
}

function storeGameVersion(version: string) {
  const content = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : ""
  const line = `GAME_VERSION=${version}`
  const updated = /^GAME_VERSION=.*$/m.test(content)
    ? content.replace(/^GAME_VERSION=.*$/m, line)
    : content + (content && !content.endsWith("\n") ? "\n" : "") + line + "\n"
  writeFileSync(ENV_FILE, updated)
}

// Arg or env > prompt (empty keeps the stored one) > stored version in .env
async function askGameVersion(): Promise<string | null> {
  const stored = storedGameVersion()
  let version = args["game-version"] || process.env.GAME_VERSION || null
  if (!version && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const hint = stored ? ` [${stored}]` : " (empty to skip)"
    version = (await rl.question(`Game version${hint}: `)).trim() || null
    rl.close()
  }
  if (!version) return stored
  if (version !== stored) storeGameVersion(version)
  return version
}

function pageUrl(lang: keyof typeof WIKIS, title: string): string {
  return `${WIKIS[lang]}/index.php?title=${encodeURIComponent(title.replace(/ /g, "_"))}`
}

function countBuildings(cache: Record<string, { content: string }>): number {
  return Object.values(cache).filter((page) => isBuildingPage(page.content)).length
}

// "Terrace Farm - Lv. 2" -> "terrace_farm_lv_2"
function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
}

// "Terrace Farm - Lv. 2" -> { id: "terrace_farm", level: 2 }
function chainOf(title: string, titles: Set<string>): Building["chain"] {
  const match = title.match(/^(.*) - Lv\. (\d+)$/)
  if (!match && !titles.has(`${title} - Lv. 2`)) return undefined
  return { id: slug(match ? match[1] : title), level: match ? Number(match[2]) : 1 }
}

// Test pages of the wiki ("Dummy Generic Hippodrome", "Placeholder 8", "... Test - Ver. 1.04")
function isPlaceholder(title: string): boolean {
  return /^(Dummy|Placeholder)\b|\bTest\b/.test(title)
}

// Trailing level number of a French title ("Ferme en terrasses - Niv. 2" -> 2)
function frenchLevel(title: string): number {
  return Number(title.match(/(\d+)\)?\s*$/)?.[1] ?? 1)
}

// id -> French page title, matched on the image asset id. Levels of a building
// share their image, so the level number in the French title decides.
async function frenchNames(
  fr: WikiClient,
  buildings: { id: string; assetId: string; level: number }[],
): Promise<Map<string, string>> {
  const wanted = new Set(buildings.map((b) => b.assetId))
  const titlesByAsset = (cache: Record<string, { content: string }>) => {
    const byAsset = new Map<string, string[]>()
    for (const [title, page] of Object.entries(cache)) {
      if (isPlaceholder(title)) continue
      // French pages use French labels ("Taille :"): the main image at the top is enough
      const assetId = buildingIdFromUrl(page.content)
      if (assetId && wanted.has(assetId))
        byAsset.set(assetId, [...(byAsset.get(assetId) ?? []), title])
    }
    return byAsset
  }
  const cache = await syncPages(fr, `${CACHE_DIR}/fr.json`, {
    offline: args.offline,
    stop: limit ? (current) => titlesByAsset(current).size >= wanted.size : undefined,
  })
  const byAsset = titlesByAsset(cache)
  // Several English pages can share an image: prefer a French title not used yet
  const names = new Map<string, string>()
  const used = new Set<string>()
  for (const { id, assetId, level } of buildings) {
    const candidates = byAsset.get(assetId) ?? []
    const free = candidates.filter((t) => !used.has(t))
    const title =
      free.find((t) => frenchLevel(t) === level) ??
      free[0] ??
      candidates.find((t) => frenchLevel(t) === level) ??
      candidates[0]
    if (title) {
      names.set(id, title)
      used.add(title)
    }
  }
  return names
}

async function main() {
  const gameVersion = await askGameVersion()
  const scrapedAt = new Date().toISOString()
  const en = new WikiClient(WIKIS.en)
  const fr = new WikiClient(WIKIS.fr)

  console.log("English wiki")
  const enCache = await syncPages(en, `${CACHE_DIR}/en.json`, {
    offline: args.offline,
    stop: limit ? (cache) => countBuildings(cache) >= limit : undefined,
  })

  // Parse English pages: they define the building list
  const issues: (Issue & { page: string })[] = []
  const parsed = new Map<string, { title: string; building: ParsedBuilding }>()
  const titles = new Set(Object.keys(enCache))
  for (const [title, page] of Object.entries(enCache).sort(([a], [b]) => a.localeCompare(b))) {
    if (limit && parsed.size >= limit) break
    if (isPlaceholder(title) || !isBuildingPage(page.content)) continue
    const result = parseBuildingPage(page.content)
    issues.push(...result.issues.map((issue) => ({ ...issue, page: title })))
    if (result.building) parsed.set(slug(title), { title, building: result.building })
  }

  // Renamed buildings often keep their old page ("Goldsmith" / "Celtic Goldsmith"):
  // same image, level and stats -> keep only the most recently edited page
  const kept = new Map<string, string>()
  for (const [id, { title, building }] of parsed) {
    const key = [
      building.assetId,
      chainOf(title, titles)?.level ?? 1,
      JSON.stringify(building.ages),
    ].join("|")
    const other = kept.get(key)
    if (!other) {
      kept.set(key, id)
      continue
    }
    const newer = enCache[title].revid > enCache[parsed.get(other)!.title].revid ? id : other
    const older = newer === id ? other : id
    issues.push({
      kind: "duplicate",
      detail: `${parsed.get(older)!.title} -> ${parsed.get(newer)!.title}`,
      page: parsed.get(older)!.title,
    })
    kept.set(key, newer)
    parsed.delete(older)
  }

  console.log("French wiki")
  const frTitles = await frenchNames(
    fr,
    [...parsed].map(([id, { title, building }]) => ({
      id,
      assetId: building.assetId,
      level: chainOf(title, titles)?.level ?? 1,
    })),
  )

  const overrides = loadOverrides()
  for (const id of Object.keys(overrides)) {
    if (!parsed.has(id)) console.warn(`  Override for unknown building: ${id}`)
  }

  // Validate and write
  mkdirSync(DATA_DIR, { recursive: true })
  const written = new Set<string>()
  let invalid = 0
  for (const [id, { title, building }] of parsed) {
    const override = overrides[id] ?? {}
    const event = eventFromAsset(building.assetId)
    const candidate: Building = {
      id,
      name: { fr: frTitles.get(id) ?? title, en: title, ...override.name },
      type: typeFromId(building.assetId),
      image: building.image,
      event: override.event ?? event?.event,
      eventYear: event?.year,
      chain: chainOf(title, titles),
      size: building.size,
      road: building.road,
      reliability: "official",
      sourceUrl: pageUrl("en", title),
      ages: building.ages,
    }
    const result = BuildingSchema.safeParse(candidate)
    if (!result.success) {
      invalid++
      issues.push({
        kind: "unparsed_text",
        detail: `invalid: ${result.error.message}`,
        page: title,
      })
      continue
    }
    writeFileSync(`${DATA_DIR}/${id}.json`, JSON.stringify(result.data, null, 2) + "\n")
    written.add(`${id}.json`)
  }

  // Stat icons (data/icons.json), taken from every page of the English wiki
  const iconUrls = new Map<string, string>()
  for (const page of Object.values(enCache)) collectIconUrls(page.content, iconUrls)
  writeFileSync("data/icons.json", JSON.stringify(statIcons(iconUrls), null, 2) + "\n")

  // A full run removes buildings that disappeared from the wiki
  if (!limit) {
    for (const file of readdirSync(DATA_DIR)) if (!written.has(file)) rmSync(`${DATA_DIR}/${file}`)
  }

  const missingFr = [...parsed.keys()].filter(
    (id) => !frTitles.has(id) && !overrides[id]?.name?.fr,
  ).length
  writeFileSync(
    "data/meta.json",
    JSON.stringify(
      {
        gameVersion,
        scrapedAt,
        sources: WIKIS,
        buildings: written.size,
        sample: Boolean(limit),
      },
      null,
      2,
    ) + "\n",
  )

  // Report: everything the parser did not understand, grouped and counted
  const grouped: Record<string, Record<string, { count: number; pages: string[] }>> = {}
  for (const { kind, detail, page } of issues) {
    const entry = ((grouped[kind] ??= {})[detail] ??= { count: 0, pages: [] })
    entry.count++
    if (entry.pages.length < 3 && !entry.pages.includes(page)) entry.pages.push(page)
  }
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(`${CACHE_DIR}/report.json`, JSON.stringify(grouped, null, 2) + "\n")

  console.log(`\n${written.size} buildings written to ${DATA_DIR} (${invalid} invalid)`)
  console.log(`French names missing: ${missingFr}`)
  console.log(`Requests: en ${en.requests}, fr ${fr.requests}`)
  for (const [kind, details] of Object.entries(grouped)) {
    console.log(`  ${kind}: ${Object.keys(details).length} distinct`)
  }
  console.log(`Details in ${CACHE_DIR}/report.json`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
