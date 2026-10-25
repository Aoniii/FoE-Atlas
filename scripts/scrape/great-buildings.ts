// Great Building pages: properties, description, boosts and the level table
//   | '''Age:''' | Iron Age          (properties, like special buildings)
//   ! Level ! Requires {{fp}} ! {{rank}} ! {{bonus icon}} ...   (header, repeated every 10 levels)
//   | 1 | 40 | 1,668 | 10 | 1,100                                (one row per level)

import type { AgeId } from "../../src/core/ages"
import type { Road, Size } from "../../src/core/building"
import { ageFromLabel } from "./mappings"

const GB_IMAGE =
  /https:\/\/[^\s|}]+\/assets\/city\/buildings\/(X_[A-Za-z0-9_]+?)(?:-[0-9a-f]+)?\.(?:png|jpg)/
const ICON = /\{\{sized-external-image\|[^|}]*\|([^}]+)\}\}/

export type ParsedGreatBuilding = {
  assetId: string
  image: string
  age?: AgeId
  size: Size
  road: Road
  description: string
  boosts: { icon?: string; name: string; text: string }[]
  levels: {
    columns: { icon?: string; label: string }[]
    rows: { level: number; cost?: number; values: string[] }[]
  }
}

export function isGreatBuildingPage(wikitext: string): boolean {
  return GB_IMAGE.test(wikitext) && /^!.*\|\s*Level\s*$/m.test(wikitext)
}

export function greatBuildingAsset(wikitext: string): string | undefined {
  return wikitext.match(GB_IMAGE)?.[1]
}

const strip = (text: string) =>
  text
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .trim()

// Last cell content of a table line ('| style="..." | content' -> 'content')
const cell = (line: string) =>
  line
    .replace(/^[|!]/, "")
    .split(/\|(?![^{]*\}\})/)
    .pop()!
    .trim()

const property = (wikitext: string, label: string) =>
  wikitext.match(new RegExp(`'''${label}:'''[^\\n]*\\n\\|[^\\n]*?\\|\\s*(.*)`))?.[1]

// Description and boosts only rely on the page layout, so they work on both wikis
export function parseGreatBuildingTexts(wikitext: string) {
  const lines = wikitext.split("\n")
  const imageLine = lines.findIndex((line) => GB_IMAGE.test(line))
  const description: string[] = []
  for (const line of lines.slice(imageLine + 1)) {
    if (/^\s*[|{!]/.test(line)) break
    description.push(line)
  }
  // Boost rows: '| ... | {{icon}}<br />[[Great Building Boosts#X|Name]]' then '| text'
  const boosts: ParsedGreatBuilding["boosts"] = []
  lines.forEach((line, index) => {
    const link = line.match(/\[\[[^\]|]*#[^\]|]*\|([^\]]+)\]\]/)
    if (!link || !line.trim().startsWith("|")) return
    const icon = line.match(ICON)?.[1].trim()
    boosts.push({ icon, name: link[1].trim(), text: strip(cell(lines[index + 1] ?? "")) })
  })
  return { description: strip(description.join(" ")), boosts }
}

function parseLevels(wikitext: string): ParsedGreatBuilding["levels"] {
  const lines = wikitext.split("\n").map((line) => line.trim())
  const start = lines.findIndex((line) => /^!.*\|\s*Level\s*$/.test(line))
  const columns: ParsedGreatBuilding["levels"]["columns"] = []
  const rows: ParsedGreatBuilding["levels"]["rows"] = []

  // Header: one or two rows of "!" cells before the first data row
  const headers: string[][] = [[]]
  let i = start
  for (; i < lines.length && !lines[i].startsWith("| "); i++) {
    if (lines[i].startsWith("|-")) headers.push([])
    else if (lines[i].startsWith("!")) headers[headers.length - 1].push(lines[i])
  }
  const [top, sub = []] = headers.filter((row) => row.length)
  const subLabels = sub.map((line) => strip(cell(line)))
  for (const line of top.slice(3)) {
    // Skip Level, Requires FP and ranking points; expand colspan headers
    const span = Number(line.match(/colspan="(\d+)"/)?.[1] ?? 1)
    const icon = line.match(ICON)?.[1].trim()
    const label = strip(cell(line))
    for (let k = 0; k < span; k++) {
      columns.push({ icon, label: span > 1 ? (subLabels.shift() ?? label) : label })
    }
  }

  // Data rows: "|-" then one "| value" line per column; header repeats are skipped
  let current: string[] = []
  const flush = () => {
    const level = Number(current[0]?.replace(/,/g, ""))
    if (current.length >= 3 && Number.isInteger(level) && level > 0) {
      const cost = Number(current[1].replace(/,/g, ""))
      rows.push({ level, cost: Number.isFinite(cost) ? cost : undefined, values: current.slice(3) })
    }
    current = []
  }
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith("|}")) break
    if (line.startsWith("|-")) flush()
    else if (line.startsWith("| ")) current.push(strip(cell(line)))
  }
  flush()
  return { columns, rows }
}

export function parseGreatBuildingPage(wikitext: string): ParsedGreatBuilding | undefined {
  const image = wikitext.match(GB_IMAGE)
  const size = strip(property(wikitext, "Size") ?? "").match(/(\d+)x(\d+)/)
  if (!image || !size) return undefined
  const street = property(wikitext, "Required Street") ?? property(wikitext, "Street") ?? ""
  const lanes = street.match(/(\d)x\d/)?.[1]
  return {
    assetId: image[1],
    image: image[0],
    age: ageFromLabel(strip(property(wikitext, "Age") ?? "")),
    // The wiki writes the game's length first: "3x2" is 2 tiles wide (x) and 3 long (y)
    size: { w: Number(size[2]), h: Number(size[1]) },
    road: lanes === "2" ? "two_lane" : lanes === "1" ? "road" : "none",
    ...parseGreatBuildingTexts(wikitext),
    levels: parseLevels(wikitext),
  }
}
