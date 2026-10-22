// Bundles data/buildings/*.json into one light file per age for the site:
//   public/data/index.json      meta + available ages
//   public/data/<AgeId>.json    every building available in that age, with that age's data only
//   public/data/buildings/<id>.json   one building with all its ages and its other levels
//   public/data/search.json     names of every building for the search bar
//   public/data/great-buildings.json         Great Buildings grid (name, image, age)
//   public/data/great-buildings/<id>.json    one Great Building with every level

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { AGE_IDS, type AgeId } from "../src/core/ages"
import { BuildingSchema, type AgeBuilding, type BuildingPage } from "../src/core/building"
import { aggregateStats } from "../src/core/efficiency"
import {
  approxValueAt,
  fitApproximate,
  fitColumn,
  valueAt,
  type ApproxModel,
} from "../src/core/gb-extrapolate"
import type { BetaGreatBuilding } from "../src/core/gb-beta"
import { GB_CAPS, MANUAL_GB_MODELS } from "../src/core/gb-models"
import {
  GB_MAX_LEVEL,
  GreatBuildingSchema,
  type GreatBuilding,
  type GreatBuildingCard,
} from "../src/core/great-building"
import { levelCost } from "../src/core/rush"
import type { SearchEntry } from "../src/core/search"

const SOURCE = "data/buildings"
const OUTPUT = "public/data"

const buildings = readdirSync(SOURCE)
  .filter((file) => file.endsWith(".json"))
  .map((file) => BuildingSchema.parse(JSON.parse(readFileSync(`${SOURCE}/${file}`, "utf8"))))
const meta = JSON.parse(readFileSync("data/meta.json", "utf8"))
const icons = existsSync("data/icons.json")
  ? JSON.parse(readFileSync("data/icons.json", "utf8"))
  : {}

// Files are replaced in place, never the whole folder: the Vite dev server
// stops serving a public folder that is deleted and recreated
mkdirSync(OUTPUT, { recursive: true })
const written = new Set([
  "index.json",
  "search.json",
  "great-buildings.json",
  "gb-rewards.json",
  "assets.json",
])

const ages: { id: AgeId; buildings: number }[] = []
for (const ageId of AGE_IDS) {
  const list: AgeBuilding[] = buildings.flatMap(({ ages: all, ...building }) => {
    const age = all[ageId]
    return age ? [{ ...building, age }] : []
  })
  if (!list.length) continue
  writeFileSync(`${OUTPUT}/${ageId}.json`, JSON.stringify(list))
  written.add(`${ageId}.json`)
  ages.push({ id: ageId, buildings: list.length })
}

writeFileSync(
  `${OUTPUT}/index.json`,
  JSON.stringify({
    gameVersion: meta.gameVersion,
    scrapedAt: meta.scrapedAt,
    ages,
    icons,
    // Building types with data, for the type filter
    types: [
      ...new Set(buildings.map((b) => b.type)),
      ...(existsSync("data/great-buildings") ? ["great_building"] : []),
    ],
  }),
)
for (const file of readdirSync(OUTPUT)) {
  if (!["buildings", "great-buildings"].includes(file) && !written.has(file)) {
    rmSync(`${OUTPUT}/${file}`)
  }
}

// Light index for the search bar: names, image and source only
const search: SearchEntry[] = buildings.map(({ id, name, image, event, eventYear }) => ({
  id,
  name,
  image,
  event,
  eventYear,
}))
writeFileSync(`${OUTPUT}/search.json`, JSON.stringify(search))

// One file per building for its own page, with the other levels of its chain
const BUILDINGS_OUTPUT = `${OUTPUT}/buildings`
mkdirSync(BUILDINGS_OUTPUT, { recursive: true })
const levelsByChain = new Map<string, BuildingPage["chainLevels"]>()
for (const building of buildings) {
  if (!building.chain) continue
  const levels = levelsByChain.get(building.chain.id) ?? []
  const stats = Object.fromEntries(
    Object.entries(building.ages).map(([age, data]) => [age, aggregateStats(data!)]),
  )
  levels.push({
    id: building.id,
    level: building.chain.level,
    name: building.name,
    size: building.size,
    road: building.road,
    stats,
  })
  levelsByChain.set(building.chain.id, levels)
}
const pages = new Set<string>()
for (const building of buildings) {
  const chainLevels = building.chain
    ? (levelsByChain.get(building.chain.id) ?? []).sort((a, b) => a.level - b.level)
    : []
  const page: BuildingPage = { ...building, chainLevels }
  writeFileSync(`${BUILDINGS_OUTPUT}/${building.id}.json`, JSON.stringify(page))
  pages.add(`${building.id}.json`)
}
for (const file of readdirSync(BUILDINGS_OUTPUT)) {
  if (!pages.has(file)) rmSync(`${BUILDINGS_OUTPUT}/${file}`)
}

// Patron rewards for the rush calculator (FoE Helper, AGPL-3.0)
if (existsSync("data/gb-rewards.json")) {
  const { rewards } = JSON.parse(readFileSync("data/gb-rewards.json", "utf8"))
  writeFileSync(`${OUTPUT}/gb-rewards.json`, JSON.stringify(rewards))
}

// Bonuses read beyond the wiki on foe-assistant.com (scripts/gb-readings.ts)
const gbReadings: Record<string, Record<string, Record<string, number>>> = existsSync(
  "data/gb-readings.json",
)
  ? JSON.parse(readFileSync("data/gb-readings.json", "utf8")).readings
  : {}

// Great Buildings of the beta server (scripts/gb-beta.ts)
const gbBeta: Record<string, BetaGreatBuilding> = existsSync("data/gb-beta.json")
  ? JSON.parse(readFileSync("data/gb-beta.json", "utf8")).buildings
  : {}

// Extends a Great Building to GB_MAX_LEVEL: exact costs; bonuses from, in order, the
// in-game readings, a progression reproducing every known level exactly (see
// gb-extrapolate.ts), empty otherwise
const unmodeled: string[] = []
const approximated: string[] = []

// Between two known levels: straight line; beyond the last one: the approximate curve
function approximateAt(
  approx: ApproxModel | undefined,
  points: [number, number][],
  level: number,
): number | undefined {
  const next = points.findIndex(([l]) => l > level)
  if (next === -1) return approx && approxValueAt(approx, level)
  const [[l0, v0], [l1, v1]] = [points[next - 1], points[next]]
  const factor = 10 ** (approx?.decimals ?? 0)
  return Math.floor((v0 + ((v1 - v0) * (level - l0)) / (l1 - l0)) * factor + 1e-9) / factor
}

function extendLevels(gb: GreatBuilding): GreatBuilding {
  const rows = gb.levels.rows
  const last = rows.at(-1)?.level ?? 0
  const firstTenCosts = rows.filter((r) => r.level <= 10).map((r) => r.cost ?? 0)
  const columns = gb.levels.columns.map((column, index) => {
    const raw = rows.map((r) => r.values[index] ?? "")
    const numbers = raw.map((v) => v.match(/^([\d,]+(?:\.\d+)?)\s*%?$/)?.[1])
    if (numbers.some((n) => n === undefined)) return undefined
    const values = [0, ...numbers.map((n) => Number(n!.replace(/,/g, "")))]
    const decimals = Math.max(...numbers.map((n) => n!.split(".")[1]?.length ?? 0))
    const percent = raw.some((v) => v.endsWith("%"))
    const read = gbReadings[gb.id]?.[column.label.en] ?? {}
    const readLevels = Object.keys(read).map(Number)
    const manual = MANUAL_GB_MODELS[gb.id]?.[column.label.en]
    if (manual) return { kind: "manual" as const, manual, read, decimals, percent }
    // Fitted on the wiki and the readings that follow it without a gap, else on the wiki
    // alone if it agrees with every reading
    const extended = [...values]
    while (read[extended.length] !== undefined) extended.push(read[extended.length])
    let model = fitColumn(extended, decimals)
    if (model) values.splice(0, values.length, ...extended)
    else {
      model = fitColumn(values, decimals)
      if (model && readLevels.some((l) => Math.abs(valueAt(model!, values, l) - read[l]) > 1e-6))
        model = undefined
    }
    if (model) return { kind: "fitted" as const, model, read, values, decimals, percent }
    // No exact model: approximate curve beyond the last known level, straight line
    // between two readings with unknown levels in between
    const known = new Map<number, number>([
      ...values.slice(1).map((value, i) => [i + 1, value] as [number, number]),
      ...readLevels.map((level) => [level, read[level]] as [number, number]),
    ])
    const points = [...known].sort(([a], [b]) => a - b)
    const approx = fitApproximate(points, decimals, percent)
    if (approx) {
      const upTo = readLevels.length ? `read up to ${Math.max(...readLevels)}, ` : ""
      approximated.push(
        `${gb.id}: ${column.label.en} (${upTo}${approx.form}, ±${approx.error.toFixed(2)})`,
      )
    } else unmodeled.push(`${gb.id}: ${column.label.en}`)
    return { kind: "approx" as const, approx, points, read, decimals, percent }
  })
  const extra = []
  for (let level = last + 1; level <= GB_MAX_LEVEL; level++) {
    extra.push({
      level,
      cost: levelCost(firstTenCosts, level),
      computed: true,
      values: columns.map((column, index) => {
        if (!column) return ""
        const value =
          column.kind === "manual"
            ? (column.manual.readings?.[level] ?? column.read[level] ?? column.manual.value(level))
            : column.kind === "fitted"
              ? (column.read[level] ?? valueAt(column.model, column.values, level))
              : (column.read[level] ?? approximateAt(column.approx, column.points, level))
        if (value === undefined) return ""
        const cap = GB_CAPS[gb.id]?.[gb.levels.columns[index].label.en] ?? Infinity
        const text = Math.min(value, cap).toLocaleString("en-US", {
          maximumFractionDigits: column.decimals,
        })
        return column.percent ? `${text}%` : text
      }),
    })
  }
  const readLevels = gb.levels.columns.flatMap((column) =>
    Object.keys(gbReadings[gb.id]?.[column.label.en] ?? {}).map(Number),
  )
  return {
    ...gb,
    readingsUpTo: readLevels.length ? Math.max(...readLevels) : undefined,
    beta: gbBeta[gb.id],
    levels: { ...gb.levels, rows: [...rows, ...extra] },
  }
}

// Great Buildings: a light grid file and one file per building
const GB_SOURCE = "data/great-buildings"
const GB_OUTPUT = `${OUTPUT}/great-buildings`
const greatBuildings = existsSync(GB_SOURCE)
  ? readdirSync(GB_SOURCE)
      .filter((file) => file.endsWith(".json"))
      .map((file) =>
        GreatBuildingSchema.parse(JSON.parse(readFileSync(`${GB_SOURCE}/${file}`, "utf8"))),
      )
  : []
mkdirSync(GB_OUTPUT, { recursive: true })
const cards: GreatBuildingCard[] = greatBuildings.map(({ id, name, image, age }) => ({
  id,
  name,
  image,
  age,
  // Highest tier on the beta server
  ...(gbBeta[id] && {
    betaTier: gbBeta[id].columns.some((column) => column.tier === "gold") ? "gold" : "copper",
  }),
}))
writeFileSync(`${OUTPUT}/great-buildings.json`, JSON.stringify(cards))
// Game asset id -> building or Great Building id, to recognize the buildings of a player's
// city (City tab). Our images are named after the asset with "SS_" after its first letter:
// .../W_SS_MultiAge_HERO24H1-<hash>.png is the game's W_MultiAge_HERO24H1
const assetOf = (image: string | undefined) => {
  const file = image?.match(/\/([A-Z])_SS_([^/]+?)-[0-9a-f]+\.\w+$/)
  return file ? `${file[1]}_${file[2]}` : undefined
}
const assets = {
  buildings: {} as Record<string, string>,
  greatBuildings: {} as Record<string, string>,
}
for (const { id, image } of buildings) {
  const asset = assetOf(image)
  if (asset) assets.buildings[asset] = id
}
for (const { id, image } of greatBuildings) {
  const asset = assetOf(image)
  if (asset) assets.greatBuildings[asset] = id
}
writeFileSync(`${OUTPUT}/assets.json`, JSON.stringify(assets))

// Great Buildings are searchable too
const gbSearch: SearchEntry[] = greatBuildings.map(({ id, name, image, age }) => ({
  id,
  name,
  image,
  age,
  kind: "great_building",
}))
writeFileSync(`${OUTPUT}/search.json`, JSON.stringify([...search, ...gbSearch]))

const gbFiles = new Set<string>()
for (const gb of greatBuildings) {
  writeFileSync(`${GB_OUTPUT}/${gb.id}.json`, JSON.stringify(extendLevels(gb)))
  gbFiles.add(`${gb.id}.json`)
}
for (const file of readdirSync(GB_OUTPUT)) if (!gbFiles.has(file)) rmSync(`${GB_OUTPUT}/${file}`)
if (approximated.length) {
  console.log(
    `Great Building bonuses approximated beyond the known levels (${approximated.length}):`,
  )
  for (const column of approximated) console.log(`  ${column}`)
}
if (unmodeled.length) {
  console.log(
    `Great Building bonuses with no formula beyond the known levels (${unmodeled.length}):`,
  )
  for (const column of unmodeled) console.log(`  ${column}`)
}

console.log(`${buildings.length} buildings bundled into ${ages.length} ages (${OUTPUT})`)
