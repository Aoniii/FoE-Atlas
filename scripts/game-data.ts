// Every building of the game, from the game's own definitions: values per age, size, road,
// chain and set links (see src/core/game-definitions.ts). First every definition of the
// game's static server (scripts/game-entities.ts, in scripts/.cache/entities/<capture>/),
// then the ones inside FoE Helper city exports (City map > Download, CityEntities) for any
// building missing there, the newest export winning. Writes data/game-buildings.json, merged
// with the wiki's buildings by scripts/build-data.ts.
//   pnpm game-data [export.json ...]   (default: every scripts/.cache/city/*_citymap_*.json)

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import type { GameBuilding } from "../src/core/game-building"
import { isCityBuilding, toGameBuilding, type Definition } from "../src/core/game-definitions"

const ENTITIES = "scripts/.cache/entities"

function exportsInCache(): string[] {
  const folder = "scripts/.cache/city"
  if (!existsSync(folder)) return []
  return readdirSync(folder)
    .filter((f) => /_citymap_.*\.json$/.test(f))
    .map((f) => `${folder}/${f}`)
}

// A definition of the static server in the form of FoE Helper's exports: without the
// "__class__" and "__enum__" keys, and the type of newer buildings from their tags
export function fromStaticData(raw: unknown): Definition {
  const strip = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(strip)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([key]) => key !== "__class__" && key !== "__enum__")
              .map(([key, field]) => [key, strip(field)]),
          )
        : value
  const def = strip(raw) as Definition & {
    components?: { AllAge?: { tags?: { tags?: { tag: string; buildingType?: string }[] } } }
  }
  const tagged = def.components?.AllAge?.tags?.tags?.find((t) => t.tag === "buildingType")
  return def.type || !tagged?.buildingType ? def : { ...def, type: tagged.buildingType }
}

// Definitions downloaded by scripts/game-entities.ts, one folder per capture
function entityFolders(): string[] {
  if (!existsSync(ENTITIES)) return []
  return readdirSync(ENTITIES).map((name) => `${ENTITIES}/${name}`)
}

function main() {
  const files = (process.argv.length > 2 ? process.argv.slice(2) : exportsInCache()).sort(
    (a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs,
  )
  const buildings = new Map<string, GameBuilding>()
  const folders = entityFolders()
  for (const folder of folders) {
    let added = 0
    for (const file of readdirSync(folder)) {
      const def = fromStaticData(JSON.parse(readFileSync(`${folder}/${file}`, "utf8")))
      if (!isCityBuilding(def) || buildings.has(def.id)) continue
      buildings.set(def.id, toGameBuilding(def))
      added++
    }
    console.log(`${folder}: ${added} buildings`)
  }
  if (!folders.length && !files.length) {
    throw new Error(
      `No definition: pnpm game-entities, or FoE Helper exports in scripts/.cache/city`,
    )
  }
  for (const file of files) {
    const { CityEntities } = JSON.parse(readFileSync(file, "utf8")) as {
      CityEntities: Record<string, Definition>
    }
    let added = 0
    for (const def of Object.values(CityEntities)) {
      if (!isCityBuilding(def) || buildings.has(def.id)) continue
      buildings.set(def.id, toGameBuilding(def))
      added++
    }
    console.log(`${file}: ${added} new buildings`)
  }
  const list = [...buildings.values()].sort((a, b) => a.gameId.localeCompare(b.gameId))
  writeFileSync(
    "data/game-buildings.json",
    JSON.stringify({
      sources: [...folders, ...files].map((f) => f.split("/").at(-1)),
      buildings: list,
    }) + "\n",
  )
  const types = Object.entries(
    list.reduce<Record<string, number>>(
      (count, b) => ({ ...count, [b.type]: (count[b.type] ?? 0) + 1 }),
      {},
    ),
  )
  console.log(`${list.length} buildings: ${types.map(([t, n]) => `${n} ${t}`).join(", ")}`)
}

if (process.argv[1]?.endsWith("game-data.ts")) main()
