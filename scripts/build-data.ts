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
import { GreatBuildingSchema, type GreatBuildingCard } from "../src/core/great-building"
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
const written = new Set(["index.json", "search.json", "great-buildings.json", "gb-rewards.json"])

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

// Patron rewards for the rush calculator (FoE Helper, AGPL-3.0)
if (existsSync("data/gb-rewards.json")) {
  const { rewards } = JSON.parse(readFileSync("data/gb-rewards.json", "utf8"))
  writeFileSync(`${OUTPUT}/gb-rewards.json`, JSON.stringify(rewards))
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
}))
writeFileSync(`${OUTPUT}/great-buildings.json`, JSON.stringify(cards))
const gbFiles = new Set<string>()
for (const gb of greatBuildings) {
  writeFileSync(`${GB_OUTPUT}/${gb.id}.json`, JSON.stringify(gb))
  gbFiles.add(`${gb.id}.json`)
}
for (const file of readdirSync(GB_OUTPUT)) if (!gbFiles.has(file)) rmSync(`${GB_OUTPUT}/${file}`)

console.log(`${buildings.length} buildings bundled into ${ages.length} ages (${OUTPUT})`)
