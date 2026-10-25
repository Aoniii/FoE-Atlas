// Every building definition of the game, from the index of a capture cleaned by
// scripts/har-extract.ts (building_entity_lookup: one public address per building on the
// game's static server). The definitions the capture already holds are taken from it, the
// others downloaded, 4 at a time, and kept in scripts/.cache/entities/<capture>/ (an address
// carries the definition's hash: a changed building is downloaded again, the rest never).
// scripts/game-data.ts reads them with the FoE Helper exports.
//   pnpm game-entities [capture]   (default: fr)

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"

type IndexEntry = { file: string; url: string }
type StaticData = { identifier: string; url: string }

const CONCURRENCY = 4

async function main() {
  const name = process.argv[2] ?? "fr"
  const capture = `scripts/.cache/har/${name}`
  const index = JSON.parse(readFileSync(`${capture}/index.json`, "utf8")) as IndexEntry[]
  const lookupFile = index.find((e) => e.url.includes("id=building_entity_lookup-"))?.file
  if (!lookupFile) throw new Error(`No building_entity_lookup in ${capture}`)
  const lookup = JSON.parse(readFileSync(`${capture}/${lookupFile}`, "utf8")) as StaticData[]
  const captured = new Map(index.map((e) => [e.url, e.file]))

  const output = `scripts/.cache/entities/${name}`
  mkdirSync(output, { recursive: true })
  const fileOf = (url: string) => `${new URL(url).searchParams.get("id")}.json`
  const wanted = new Set(lookup.map((entry) => fileOf(entry.url)))
  // Definitions of an older version of the game
  for (const file of readdirSync(output)) if (!wanted.has(file)) rmSync(`${output}/${file}`)

  let fromCapture = 0
  const missing: StaticData[] = []
  for (const entry of lookup) {
    const file = `${output}/${fileOf(entry.url)}`
    if (existsSync(file)) continue
    const inCapture = captured.get(entry.url)
    if (inCapture) {
      writeFileSync(file, readFileSync(`${capture}/${inCapture}`))
      fromCapture++
    } else missing.push(entry)
  }

  let done = 0
  const failed: string[] = []
  const worker = async () => {
    for (let entry = missing.shift(); entry; entry = missing.shift()) {
      try {
        const response = await fetch(entry.url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const definition = (await response.json()) as { id?: string }
        if (!definition.id) throw new Error("not a definition")
        writeFileSync(`${output}/${fileOf(entry.url)}`, JSON.stringify(definition))
      } catch (error) {
        failed.push(`${entry.identifier}: ${(error as Error).message}`)
      }
      if (++done % 200 === 0) console.log(`  ${done} downloaded`)
    }
  }
  const toDownload = missing.length
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  console.log(
    `${lookup.length} definitions in ${output}: ${fromCapture} from the capture, ${toDownload - failed.length} downloaded`,
  )
  for (const line of failed) console.log(`  failed: ${line}`)
}

main()
