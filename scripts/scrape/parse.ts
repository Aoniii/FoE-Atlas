import type { AgeId } from "../../src/core/ages"
import type { AgeData, Reward, Road, Size } from "../../src/core/building"
import { ICON_PACKS, IGNORED_ICONS, KNOWN_ITEMS, ageFromLabel, iconStats } from "./mappings"

export type IssueKind =
  | "no_image"
  | "no_size"
  | "unsupported_format"
  | "unknown_era"
  | "unknown_header"
  | "no_production_column"
  | "unknown_icon"
  | "unparsed_text"
  | "duplicate"
  | "non_daily_production"

export type Issue = { kind: IssueKind; detail: string }

export type ParsedBuilding = {
  // Image asset id: shared by every level of a building
  assetId: string
  // Titles of the buildings this one upgrades to with a kit
  upgradesTo: string[]
  image: string
  size: Size
  road: Road
  ages: Partial<Record<AgeId, AgeData>>
}

type Entry = { amount: number; icon: string; iconUrl: string; label: string }

const BUILDING_IMAGE =
  /https:\/\/[^\s|}]+\/assets\/city\/buildings\/([A-Za-z0-9_]+?)(?:-[0-9a-f]+)?\.png/
const ICON_TEMPLATE = /\{\{sized-external-image\|[^|}]*\|([^}]+)\}\}/g

// Every icon of a page: icon key -> URL (used to give each stat its icon)
export function collectIconUrls(wikitext: string, into: Map<string, string>) {
  for (const match of wikitext.matchAll(ICON_TEMPLATE)) {
    const url = match[1].trim()
    const key = iconKey(url)
    if (!into.has(key)) into.set(key, url)
  }
}

export function buildingIdFromUrl(url: string): string | undefined {
  return url.match(BUILDING_IMAGE)?.[1]
}

export function isBuildingPage(wikitext: string): boolean {
  return BUILDING_IMAGE.test(wikitext) && wikitext.includes("'''Size:'''")
}

function stripMarkup(text: string): string {
  return text
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .trim()
}

// "icons/reward_icons/reward_icon_one_up_kit-395ac8f66.png" -> "reward_icon_one_up_kit"
export function iconKey(url: string): string {
  const file = url.slice(url.lastIndexOf("/") + 1)
  return file.replace(/\.(png|jpg)$/, "").replace(/-[0-9a-f]{6,}$/, "")
}

// Value of a "'''Label:'''" property row (the next table cell)
function property(wikitext: string, label: string): string | undefined {
  const match = wikitext.match(new RegExp(`'''${label}:'''[^\\n]*\\n\\|[^\\n]*?\\|\\s*(.*)`))
  return match?.[1]
}

// Positions of every "|" outside {{templates}}
function topLevelPipes(text: string): number[] {
  const pipes: number[] = []
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith("{{", i)) {
      depth++
      i++
    } else if (text.startsWith("}}", i)) {
      depth--
      i++
    } else if (text[i] === "|" && depth === 0) {
      pipes.push(i)
    }
  }
  return pipes
}

// '| style="..." | content' -> 'content'
function cellContent(line: string): string {
  const body = line.replace(/^[|!]/, "")
  const pipes = topLevelPipes(body)
  if (pipes.length && /^\s*[a-z-]+\s*=/i.test(body.slice(0, pipes[0]))) {
    return body.slice(pipes[pipes.length - 1] + 1).trim()
  }
  return body.trim()
}

type Row = { headers: string[]; cells: string[] }

// Parses the per-era table into rows of header and data cells (nested tables kept as text)
function parseEraTable(wikitext: string): Row[] | undefined {
  const lines = wikitext.split("\n")
  const eraHeader = lines.findIndex((l) => /^!.*\|\s*Era\s*$/.test(l.trim()))
  if (eraHeader === -1) return undefined
  let start = eraHeader
  while (start > 0 && !lines[start].trim().startsWith("{|")) start--

  const rows: Row[] = []
  let row: Row | undefined
  let depth = 0
  for (const raw of lines.slice(start + 1)) {
    const line = raw.trim()
    if (depth > 0) {
      if (line.startsWith("{|")) depth++
      else if (line.startsWith("|}")) depth--
      if (row?.cells.length) row.cells[row.cells.length - 1] += "\n" + line
      continue
    }
    if (line.startsWith("{|")) {
      depth = 1
      continue
    }
    if (line.startsWith("|}")) break
    if (line.startsWith("|-")) {
      row = { headers: [], cells: [] }
      rows.push(row)
    } else if (line.startsWith("!")) {
      row?.headers.push(cellContent(line))
    } else if (line.startsWith("|")) {
      row?.cells.push(cellContent(line))
    } else if (line && row?.cells.length) {
      row.cells[row.cells.length - 1] += "\n" + line
    }
  }
  return rows.filter((r) => r.headers.length || r.cells.length)
}

// One "amount {{icon}} label" segment (amount may come after the label: "1 Blueprint {{icon}}")
function segmentEntries(segment: string): Entry[] {
  const matches = [...segment.matchAll(ICON_TEMPLATE)]
  if (matches.length === 1) {
    const rest = segment.replace(matches[0][0], " ")
    const amount = rest.match(/[+-]?\d[\d,]*(?:\.\d+)?/)
    return [
      {
        amount: amount ? Number(amount[0].replace(/,/g, "")) : 1,
        icon: iconKey(matches[0][1]),
        iconUrl: matches[0][1].trim(),
        label: stripMarkup(rest.replace(amount?.[0] ?? "", "").replace(/%/g, "")),
      },
    ]
  }
  // Several icons: each one takes the number right before it
  return matches.flatMap((match) => {
    const amount = segment.slice(0, match.index).match(/([+-]?[\d.,]+)\s*%?\s*$/)
    if (!amount) return []
    return [
      {
        amount: Number(amount[1].replace(/,/g, "")),
        icon: iconKey(match[1]),
        iconUrl: match[1].trim(),
        label: stripMarkup(segment.slice(match.index + match[0].length).split("{{")[0]),
      },
    ]
  })
}

type CellOutputs = {
  guaranteed: Entry[]
  motivated: Entry[]
  random: { motivated: boolean; options: { chance: number; entries: Entry[] }[] }[]
}

const BLOCK_END = "\u0000"

// A cell is a list of segments (nested table rows, <br> separated). Markers:
// "When motivated:" switches to motivated output, "Random" opens a block of
// "50%: ..." options, closed by the end of its nested table.
function parseCell(cell: string, issues: Issue[], context: string): CellOutputs {
  const result: CellOutputs = { guaranteed: [], motivated: [], random: [] }
  const segments = cell.split("\n").flatMap((line) => {
    if (line.startsWith("|}")) return [BLOCK_END]
    if (/^\{\||^\|-/.test(line)) return []
    return (line.startsWith("|") ? cellContent(line) : line).split(/<br\s*\/?>/i)
  })

  let motivated = false
  let random: CellOutputs["random"][number] | undefined
  const closeRandom = () => {
    if (random?.options.length) result.random.push(random)
    random = undefined
  }

  for (const segment of segments) {
    if (segment === BLOCK_END) {
      closeRandom()
      continue
    }
    const plain = stripMarkup(segment)
    if (!plain && !ICON_TEMPLATE.test(segment)) continue
    ICON_TEMPLATE.lastIndex = 0
    if (/^when motivated/i.test(plain)) {
      closeRandom()
      motivated = true
      continue
    }
    if (/^random\b/i.test(plain)) {
      closeRandom()
      random = { motivated, options: [] }
      continue
    }
    const chance = plain.match(/^(\d+(?:\.\d+)?)\s*%\s*:/)
    const body = chance ? segment.replace(/^[^:]*:/, "") : segment
    const entries = segmentEntries(body)
    // "10x Rogue": units written without an icon
    const units = stripMarkup(body).match(/^(\d+)x\s+(.+)$/)
    if (!entries.length && units) {
      entries.push({ amount: Number(units[1]), icon: "military", iconUrl: "", label: units[2] })
    }
    // "Guild Treasury: 7,200 {{goods}}": goods paid to the guild, not to the player
    if (/guild treasury/i.test(plain)) {
      for (const entry of entries) if (entry.icon.includes("good")) entry.icon = "guild_treasury"
    }
    if (!entries.length) {
      issues.push({ kind: "unparsed_text", detail: `${context}: ${plain}` })
      continue
    }
    if (chance) {
      random ??= { motivated, options: [] }
      random.options.push({ chance: Number(chance[1]), entries })
    } else {
      closeRandom()
      result[motivated ? "motivated" : "guaranteed"].push(...entries)
    }
  }
  closeRandom()
  return result
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
}

function toRewards(entry: Entry, issues: Issue[]): Reward[] {
  if (IGNORED_ICONS.has(entry.icon)) return []
  const stats = iconStats(entry.icon)
  if (stats) return stats.map((stat) => ({ type: "stat", stat, amount: entry.amount }))
  const pack = ICON_PACKS[entry.icon]
  if (pack) return [{ type: "stat", stat: pack[0], amount: entry.amount * pack[1] }]
  if (!KNOWN_ITEMS.has(entry.icon)) issues.push({ kind: "unknown_icon", detail: entry.icon })
  const name = entry.label || entry.icon
  // Fragments share one icon: their label tells them apart
  const id = entry.icon === "icon_fragment" ? `fragment_${slugify(name)}` : entry.icon
  return [
    {
      type: "item",
      id,
      name: { fr: name, en: name },
      amount: entry.amount,
      ...(entry.iconUrl && { icon: entry.iconUrl }),
    },
  ]
}

type ColumnKind = "production" | "demand" | "passive" | "skip"

function columnKind(header: string): ColumnKind | undefined {
  const text = stripMarkup(header).toLowerCase()
  if (text.includes("production")) return "production"
  if (text.includes("demand")) return "demand"
  // "boosts", not "boost": "Boosted Collection" describes a mechanic, not values
  if (/provide|bonus|boosts|happiness/.test(text)) return "passive"
  if (text.includes("point")) return "skip"
  return undefined
}

// Picks the 24h production column ("1d"), or the only one there is
function productionColumn(headers: string[]): number | undefined {
  const production = headers
    .map((header, index) => ({ text: stripMarkup(header), index }))
    .filter(({ text }) => /production/i.test(text))
  if (production.length === 1) return production[0].index
  return production.find(({ text }) => /\b(1d|24h)\b/i.test(text))?.index
}

// Adds a parsed cell to an age: production outputs, or summed passive values
function addCell(data: AgeData, kind: ColumnKind, outputs: CellOutputs, issues: Issue[]) {
  const rewards = (entries: Entry[]) => entries.flatMap((entry) => toRewards(entry, issues))
  if (kind !== "production") {
    const sign = kind === "demand" ? -1 : 1
    for (const reward of rewards([...outputs.guaranteed, ...outputs.motivated])) {
      if (reward.type !== "stat") continue
      data.passive[reward.stat] = (data.passive[reward.stat] ?? 0) + sign * reward.amount
    }
    return
  }
  const guaranteed = rewards(outputs.guaranteed)
  const motivated = rewards(outputs.motivated)
  if (guaranteed.length) data.production.push({ kind: "guaranteed", rewards: guaranteed })
  if (motivated.length) {
    data.production.push({ kind: "guaranteed", motivated: true, rewards: motivated })
  }
  for (const block of outputs.random) {
    const options = block.options
      .map((option) => ({ chance: option.chance, rewards: rewards(option.entries) }))
      .filter((option) => option.rewards.length)
    if (options.length) {
      data.production.push({
        kind: "random",
        ...(block.motivated && { motivated: true }),
        options,
      })
    }
  }
}

// Property rows of the top table (Boosts, 1d Production...) -> label -> cell content
function properties(wikitext: string): Map<string, string> {
  const result = new Map<string, string>()
  const lines = wikitext.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const label = lines[i].trim().match(/^\|.*'''(.+?):'''\s*$/)?.[1]
    if (!label || !lines[i + 1]?.trim().startsWith("|")) continue
    const cell = [lines[i + 1].trim()]
    let depth = 0
    for (let j = i + 2; j < lines.length; j++) {
      const line = lines[j].trim()
      if (depth === 0 && (line.startsWith("|-") || line.startsWith("|}"))) break
      if (line.startsWith("{|")) depth++
      else if (line.startsWith("|}")) depth--
      cell.push(line)
    }
    result.set(stripMarkup(label), cell.join("\n"))
  }
  return result
}

// Age-independent values from the properties: boosts, provides, demands, 1d production
function constantData(props: Map<string, string>, issues: Issue[]): AgeData {
  const data: AgeData = { passive: {}, production: [] }
  for (const [label, cell] of props) {
    const kind = columnKind(label)
    if (!kind || kind === "skip") continue
    if (kind === "production" && !/^1d production$/i.test(label)) {
      issues.push({ kind: "non_daily_production", detail: label })
      continue
    }
    addCell(data, kind, parseCell(cell, issues, `properties / ${label}`), issues)
  }
  return data
}

export function parseBuildingPage(wikitext: string): {
  building?: ParsedBuilding
  issues: Issue[]
} {
  const issues: Issue[] = []
  const image = wikitext.match(BUILDING_IMAGE)
  if (!image) return { issues: [{ kind: "no_image", detail: "" }] }

  const sizeMatch = stripMarkup(property(wikitext, "Size") ?? "").match(/(\d+)x(\d+)/)
  if (!sizeMatch) return { issues: [{ kind: "no_size", detail: "" }] }

  // "1x1", "2x2", "No street required", "[[StreetLevel:: 1x1]]"
  const street = property(wikitext, "Required Street") ?? property(wikitext, "Street") ?? ""
  const lanes = street.match(/(\d)x\d/)?.[1]
  const road: Road = lanes === "2" ? "two_lane" : lanes === "1" ? "road" : "none"

  const rows = parseEraTable(wikitext)
  // Single-age buildings, settlements and Great Buildings use another table layout
  if (!rows?.length) return { issues: [{ kind: "unsupported_format", detail: "" }] }

  // First row holds the column headers: "Era", "Points", "Demands", "... Production"
  const headers = rows[0].headers.slice(1)
  const kinds = headers.map((header) => {
    const kind = columnKind(header)
    if (!kind) issues.push({ kind: "unknown_header", detail: stripMarkup(header) })
    return kind
  })
  const production = productionColumn(headers)
  // No production at all is fine (boost-only buildings); several without a 1d one is not
  if (production === undefined && kinds.includes("production")) {
    issues.push({ kind: "no_production_column", detail: headers.map(stripMarkup).join(", ") })
  }

  // Values that do not depend on the age, listed in the properties ("Boosts: 198%")
  const constant = constantData(properties(wikitext), issues)

  const ages: Partial<Record<AgeId, AgeData>> = {}
  for (const row of rows.slice(1)) {
    const label = stripMarkup(row.headers[0] ?? "")
    const age = ageFromLabel(label)
    if (!age) {
      issues.push({ kind: "unknown_era", detail: label })
      continue
    }
    const data: AgeData = { passive: { ...constant.passive }, production: [...constant.production] }
    row.cells.forEach((cell, index) => {
      const kind = kinds[index]
      if (kind === "skip" || !kind) return
      if (kind === "production" && index !== production) return
      const context = `${label} / ${stripMarkup(headers[index])}`
      addCell(data, kind, parseCell(cell, issues, context), issues)
    })
    ages[age] = data
  }

  return {
    building: {
      assetId: image[1],
      upgradesTo: [...wikitext.matchAll(/upgrades? this building to \[\[([^\]|]+)/g)].map((m) =>
        m[1].trim(),
      ),
      image: image[0],
      size: { w: Number(sizeMatch[1]), h: Number(sizeMatch[2]) },
      road,
      ages,
    },
    issues,
  }
}
