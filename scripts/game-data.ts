// Every building of the game, from the building definitions inside FoE Helper city exports
// (City map > Download, CityEntities): values per age, size, road, chain and set links (see
// src/core/game-definitions.ts). Each export only holds part of the game's buildings: every
// export given is merged, the newest one winning. Writes data/game-buildings.json, merged
// with the wiki's buildings by scripts/build-data.ts.
//   pnpm game-data [export.json ...]   (default: every scripts/.cache/city/*_citymap_*.json)

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import type { GameBuilding } from "../src/core/game-building"
import { isCityBuilding, toGameBuilding, type Definition } from "../src/core/game-definitions"

function exportsInCache(): string[] {
  const folder = "scripts/.cache/city"
  const files = readdirSync(folder)
    .filter((f) => /_citymap_.*\.json$/.test(f))
    .map((f) => `${folder}/${f}`)
  if (!files.length) throw new Error(`No FoE Helper export in ${folder}`)
  return files
}

function main() {
  const files = (process.argv.length > 2 ? process.argv.slice(2) : exportsInCache()).sort(
    (a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs,
  )
  const buildings = new Map<string, GameBuilding>()
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
    JSON.stringify({ sources: files.map((f) => f.split("/").at(-1)), buildings: list }) + "\n",
  )
  const types = Object.entries(
    list.reduce<Record<string, number>>(
      (count, b) => ({ ...count, [b.type]: (count[b.type] ?? 0) + 1 }),
      {},
    ),
  )
  console.log(`${list.length} buildings: ${types.map(([t, n]) => `${n} ${t}`).join(", ")}`)
}

main()
