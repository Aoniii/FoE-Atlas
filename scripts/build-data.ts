// Bundles data/buildings/*.json into one light file per age for the site:
//   public/data/index.json      meta + available ages
//   public/data/<AgeId>.json    every building available in that age, with that age's data only
//   public/data/buildings/<id>.json   one building with all its ages and its other levels
//   public/data/search.json     names of every building for the search bar

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { AGE_IDS, type AgeId } from "../src/core/ages"
import { BuildingSchema, type AgeBuilding, type BuildingPage } from "../src/core/building"
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
const written = new Set(["index.json", "search.json"])

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
  JSON.stringify({ gameVersion: meta.gameVersion, scrapedAt: meta.scrapedAt, ages, icons }),
)
for (const file of readdirSync(OUTPUT)) {
  if (file !== "buildings" && !written.has(file)) rmSync(`${OUTPUT}/${file}`)
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
  levels.push({ id: building.id, level: building.chain.level, name: building.name })
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

console.log(`${buildings.length} buildings bundled into ${ages.length} ages (${OUTPUT})`)
