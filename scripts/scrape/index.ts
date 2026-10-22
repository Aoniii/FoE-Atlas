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
import { GreatBuildingSchema, type GreatBuilding } from "../../src/core/great-building"
import { buildChains, slug } from "./chains"
import { eventFromAsset } from "./events"
import {
  greatBuildingAsset,
  isGreatBuildingPage,
  parseGreatBuildingPage,
  parseGreatBuildingTexts,
} from "./great-buildings"
import { statIcons, typeFromId } from "./mappings"
import {
  buildingIdFromUrl,
  collectIconUrls,
  iconKey,
  isBuildingPage,
  parseBuildingPage,
  type Issue,
  type ParsedBuilding,
} from "./parse"
import { writeWikiPages } from "./pages"
import { WikiClient, loadCache, syncPages } from "./wiki"

// Overridable to test against a local fake wiki
const WIKIS = {
  en: process.env.WIKI_EN ?? "https://en.wiki.forgeofempires.com",
  fr: process.env.WIKI_FR ?? "https://fr.wiki.forgeofempires.com",
}
const CACHE_DIR = "scripts/.cache"
const DATA_DIR = "data/buildings"
const GB_DIR = "data/great-buildings"
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

// Level written in the title ("Terrace Farm - Lv. 2" -> 2), to match French titles
function titleLevel(title: string): number {
  return Number(title.match(/ - Lv\. (\d+)$/)?.[1] ?? 1)
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
    const key = [building.assetId, titleLevel(title), JSON.stringify(building.ages)].join("|")
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
      level: titleLevel(title),
    })),
  )

  const chains = buildChains(
    [...parsed].map(([id, { title, building }]) => ({
      id,
      title,
      upgradesTo: building.upgradesTo,
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
      chain: chains.get(id),
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

  // Great Buildings: their own pages and files, French texts matched on the image asset id
  const frCache = loadCache(`${CACHE_DIR}/fr.json`)
  const frGreatBuildings = new Map<string, { title: string; content: string }>()
  for (const [title, page] of Object.entries(frCache)) {
    const assetId = greatBuildingAsset(page.content)
    // A level table ("Niveau") tells the building page from lists sharing its image
    const hasLevels = /^!.*\|\s*Niveau\s*$/m.test(page.content)
    if (assetId && hasLevels && !isPlaceholder(title) && !frGreatBuildings.has(assetId)) {
      frGreatBuildings.set(assetId, { title, content: page.content })
    }
  }
  mkdirSync(GB_DIR, { recursive: true })
  const gbWritten = new Set<string>()
  const sameIcon = (a?: string, b?: string) => !!a && !!b && iconKey(a) === iconKey(b)
  for (const [title, page] of Object.entries(enCache)) {
    if (isPlaceholder(title) || !isGreatBuildingPage(page.content)) continue
    const gb = parseGreatBuildingPage(page.content)
    if (!gb) {
      issues.push({ kind: "unsupported_format", detail: "great building", page: title })
      continue
    }
    const fr = frGreatBuildings.get(gb.assetId)
    const frTexts = fr ? parseGreatBuildingTexts(fr.content) : undefined
    const frBoost = (icon?: string) => frTexts?.boosts.find((b) => sameIcon(b.icon, icon))
    const candidate: GreatBuilding = {
      id: slug(title),
      name: { fr: fr?.title ?? title, en: title },
      image: gb.image,
      age: gb.age,
      size: gb.size,
      road: gb.road,
      description: { fr: frTexts?.description || gb.description, en: gb.description },
      boosts: gb.boosts.map((boost) => ({
        icon: boost.icon,
        name: { fr: frBoost(boost.icon)?.name || boost.name, en: boost.name },
        text: { fr: frBoost(boost.icon)?.text || boost.text, en: boost.text },
      })),
      levels: {
        // Headers take the name of the boost with the same icon
        columns: gb.levels.columns.map((column) => {
          const boost = gb.boosts.find((b) => sameIcon(b.icon, column.icon))
          const frName = frBoost(column.icon)?.name || boost?.name || ""
          const enName = boost?.name || ""
          // Sub-columns ("#", "%") keep their boost name: "Good production (%)"
          const label = (name: string) =>
            column.label && name ? `${name} (${column.label})` : column.label || name
          return { icon: column.icon, label: { fr: label(frName), en: label(enName) } }
        }),
        rows: gb.levels.rows,
      },
      sourceUrl: pageUrl("en", title),
    }
    const result = GreatBuildingSchema.safeParse(candidate)
    if (!result.success) {
      issues.push({
        kind: "unparsed_text",
        detail: `invalid: ${result.error.message}`,
        page: title,
      })
      continue
    }
    writeFileSync(`${GB_DIR}/${candidate.id}.json`, JSON.stringify(result.data, null, 2) + "\n")
    gbWritten.add(`${candidate.id}.json`)
  }
  if (!limit) {
    for (const file of readdirSync(GB_DIR)) if (!gbWritten.has(file)) rmSync(`${GB_DIR}/${file}`)
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

  // Titles and pictures of every building page, for the buildings known only from the game
  writeWikiPages(CACHE_DIR)

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
  console.log(`${gbWritten.size} great buildings written to ${GB_DIR}`)
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
