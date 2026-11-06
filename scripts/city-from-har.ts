// Cities found in a capture of the game (.har): the player's own and every city visited, each
// written as a FoE Helper city map export the City tab imports (see src/core/har-city.ts).
//   pnpm city-from-har <capture.har> [output folder, default the capture's folder]
// The .har holds the player's session: delete it after.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { citiesFromHar } from "../src/core/har-city"

const [file, output = file && dirname(file)] = process.argv.slice(2)
if (!file) throw new Error("Usage: pnpm city-from-har <capture.har> [output folder]")
// Definitions already cached by earlier captures and pnpm game-entities, for the buildings the
// browser did not download again (its own cache)
const known = new Map<string, unknown>()
for (const folder of [
  "scripts/.cache/entities/fr",
  "scripts/.cache/har/fr",
  "scripts/.cache/har/live",
]) {
  if (!existsSync(folder)) continue
  for (const name of readdirSync(folder).filter((f) => f.endsWith(".json"))) {
    const text = readFileSync(`${folder}/${name}`, "utf8")
    if (!text.includes('"asset_id"')) continue
    try {
      const json = JSON.parse(text)
      for (const item of Array.isArray(json) ? json : [json]) {
        if (item?.id && item.asset_id) known.set(item.id, item)
      }
    } catch {
      // Not JSON
    }
  }
}
const cities = citiesFromHar(JSON.parse(readFileSync(file, "utf8")), new Date(), known)
if (!cities.length) console.log("No city in this capture: load the game or visit a city first")
for (const city of cities) {
  const path = `${output}/${city.fileName}`
  writeFileSync(path, JSON.stringify(city.data))
  const entities = Object.keys(city.data.CityMapData).length
  const ids = new Set(Object.values(city.data.CityMapData).map((e) => e.cityentity_id))
  const missing = [...ids].filter((id) => id && !city.data.CityEntities[id])
  console.log(
    `${city.playerName ?? city.playerId} (${city.world}): ${entities} entities, ${ids.size - missing.length}/${ids.size} definitions -> ${path}`,
  )
  if (missing.length) console.log(`  no definition: ${missing.join(", ")}`)
}
console.log("You can now delete the .har file: it holds your session.")
