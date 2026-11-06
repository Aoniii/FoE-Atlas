// The rated city as an Excel workbook, with its analysis kept alive: the score of each line is
// an Excel formula over the stats and the settings sheet (references, stats counted, boost
// bases), so changing a setting in Excel recalculates every score, as on the site.
//   Réglages / Settings: boost bases, then one row per stat (reference, counted, points)
//   Ville / City: one row per line of the city, its stats, its score by formula
//   Total: the city's totals by formula, and the buildings FoE Atlas does not know
// ExcelJS is loaded on demand: the site does not carry it until a city is exported.

import { AGES } from "@/core/ages"
import type { CityRow, RatedCity } from "@/core/city"
import { DEFAULT_REFERENCES, score, type BoostBases } from "@/core/efficiency"
import { STAT_KEYS, STATS, type StatDef, type StatKey } from "@/core/stats"
import { localized, type Locale, type Messages } from "@/lib/i18n"

// Excel column letters: 1 -> A, 27 -> AA
const column = (index: number): string =>
  index <= 0
    ? ""
    : column(Math.floor((index - 1) / 26)) + String.fromCharCode(65 + ((index - 1) % 26))

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } } as const
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" } }
const PERCENT = '0" %"'
const NUMBER = "#,##0"

export async function exportCity(options: {
  rated: RatedCity
  scoreKeys: StatKey[]
  bases: BoostBases
  t: Messages
  locale: Locale
  fileName: string
}) {
  const { rated, scoreKeys, bases, t, locale } = options
  const x = t.city.export
  const { default: ExcelJS } = await import("exceljs")
  const book = new ExcelJS.Workbook()
  book.creator = "FoE Atlas"
  book.created = new Date()

  const rows = rated.rows
  // Stats any line has, in the site's order; the bases of the percent boosts always present
  const used = STAT_KEYS.filter((key) => rows.some((row) => row.stats[key]))
  const settingsKeys = STAT_KEYS.filter(
    (key) => used.includes(key) || ["fp", "goods", "guild_goods"].includes(key),
  )
  const counted = new Set(scoreKeys)

  // ---- Réglages ----
  const settings = book.addWorksheet(x.settingsSheet)
  settings.columns = [
    { width: 44 },
    { width: 16 },
    { width: 16 },
    { width: 12 },
    { width: 18 },
    { width: 18 },
  ]
  settings.addRow([x.settingsTitle]).font = { bold: true, size: 14 }
  settings.addRow([x.settingsNote]).font = { italic: true, color: { argb: "FF6B7280" } }
  settings.addRow([])
  const baseRow: Record<keyof BoostBases, number> = { fp: 0, goods: 0, guild_goods: 0 }
  for (const key of ["fp", "goods", "guild_goods"] as const) {
    const row = settings.addRow([x.bases[key], bases[key]])
    row.getCell(2).numFmt = NUMBER
    row.getCell(2).font = { color: { argb: "FF1D4ED8" } }
    baseRow[key] = row.number
  }
  settings.addRow([])
  const head = settings.addRow([x.stat, x.reference, x.boosts, x.counted, x.points])
  head.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
  })
  // Row of each stat, then its formula (bases of boosts are on earlier rows of the table)
  const statRow = new Map<StatKey, number>()
  const first = head.number + 1
  settingsKeys.forEach((key, i) => statRow.set(key, first + i))
  for (const key of settingsKeys) {
    const def: StatDef = STATS[key]
    const r = statRow.get(key)!
    const reference = def.boosts ? undefined : DEFAULT_REFERENCES[key]
    const row = settings.addRow([
      t.statsFull[key],
      reference ?? null,
      def.boosts ? t.statsFull[def.boosts] : null,
      counted.has(key) ? 1 : 0,
    ])
    // Points per unit: 1 / reference, or for a boost its base's share of the daily production
    const base = def.boosts && statRow.get(def.boosts)
    const formula =
      def.boosts && base
        ? `IF(AND(D${r}=1,B${base}<>""),$B$${baseRow[def.boosts]}/100/B${base},0)`
        : `IF(AND(D${r}=1,B${r}<>""),1/B${r},0)`
    const points = score({ [key]: 1 }, 1, counted.has(key) ? [key] : [], DEFAULT_REFERENCES, bases)
    row.getCell(5).value = { formula, result: points }
    row.getCell(5).numFmt = "0.0000"
    for (const c of [2, 4]) row.getCell(c).font = { color: { argb: "FF1D4ED8" } }
  }
  settings.views = [{ state: "frozen", ySplit: head.number }]

  // ---- Ville ----
  const sheet = book.addWorksheet(x.citySheet)
  const fixed = [x.name, x.kind, x.ageOrLevel, x.count, x.tiles, x.score]
  const firstStat = fixed.length + 1
  const lastStat = fixed.length + used.length
  const statRange = (r: number | string) => `${column(firstStat)}${r}:${column(lastStat)}${r}`
  sheet.columns = [
    { width: 40 },
    { width: 18 },
    { width: 22 },
    { width: 9 },
    { width: 9 },
    { width: 10 },
    ...used.map(() => ({ width: 14 })),
  ]
  // Row 1, hidden: each stat's points per unit, from the settings
  const factors = sheet.addRow([...fixed.map(() => null), ...used.map(() => null)])
  used.forEach((key, i) => {
    factors.getCell(firstStat + i).value = {
      formula: `'${x.settingsSheet}'!E${statRow.get(key)}`,
      result: score({ [key]: 1 }, 1, counted.has(key) ? [key] : [], DEFAULT_REFERENCES, bases),
    }
  })
  factors.hidden = true
  const header = sheet.addRow([...fixed, ...used.map((key) => t.statsFull[key])])
  header.height = 48
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { wrapText: true, vertical: "middle" }
  })
  const ageName = (row: CityRow) => {
    if (row.kind === "great_building") return `${x.level} ${row.level}`
    const age = AGES.find((a) => a.id === row.age)
    return age ? localized(age.name, locale) : row.age
  }
  const sorted = [...rows].sort((a, b) => b.score - a.score)
  for (const row of sorted) {
    const line = sheet.addRow([
      localized(row.name, locale),
      row.kind === "great_building" ? t.types.great_building : x.building,
      ageName(row),
      row.count,
      row.tiles,
      null,
      ...used.map((key) => row.stats[key] ?? null),
    ])
    const r = line.number
    line.getCell(fixed.length).value = {
      formula: `IF(E${r}=0,0,SUMPRODUCT($${column(firstStat)}$1:$${column(lastStat)}$1,${statRange(r)})/E${r})`,
      result: row.score,
    }
    line.getCell(fixed.length).numFmt = "0.00"
    line.getCell(5).numFmt = "0.#"
    used.forEach((key, i) => {
      line.getCell(firstStat + i).numFmt =
        (STATS[key] as StatDef).unit === "percent" ? PERCENT : NUMBER
    })
  }
  const last = sheet.rowCount
  sheet.views = [{ state: "frozen", ySplit: 2, xSplit: 1 }]
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: lastStat } }
  // Score colors: red to green, as on the site
  sheet.addConditionalFormatting({
    ref: `${column(fixed.length)}3:${column(fixed.length)}${last}`,
    rules: [
      {
        type: "colorScale",
        priority: 1,
        cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }],
        color: [{ argb: "FFF8696B" }, { argb: "FFFFEB84" }, { argb: "FF63BE7B" }],
      },
    ],
  })

  // ---- Total ----
  const total = book.addWorksheet(x.totalSheet)
  total.columns = [{ width: 44 }, { width: 18 }]
  total.addRow([x.totalTitle]).font = { bold: true, size: 14 }
  total.addRow([x.totalNote]).font = { italic: true, color: { argb: "FF6B7280" } }
  total.addRow([])
  const city = `'${x.citySheet}'`
  const sum = (col: string) => `SUMPRODUCT(${city}!$D$3:$D$${last},${city}!${col}3:${col}${last})`
  const counts = total.addRow([x.buildings, { formula: `SUM(${city}!D3:D${last})` }])
  counts.getCell(2).numFmt = NUMBER
  const tiles = total.addRow([x.allTiles, { formula: sum("E") }])
  tiles.getCell(2).numFmt = "#,##0.#"
  const points = total.addRow([
    x.allPoints,
    { formula: `SUMPRODUCT(${city}!D3:D${last},${city}!E3:E${last},${city}!F3:F${last})` },
  ])
  points.getCell(2).numFmt = "#,##0.0"
  total.addRow([])
  const statsHead = total.addRow([x.stat, x.cityTotal])
  statsHead.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
  })
  used.forEach((key, i) => {
    const value = rows.reduce((s, row) => s + (row.stats[key] ?? 0) * row.count, 0)
    const line = total.addRow([
      t.statsFull[key],
      { formula: sum(column(firstStat + i)), result: value },
    ])
    line.getCell(2).numFmt = (STATS[key] as StatDef).unit === "percent" ? PERCENT : NUMBER
  })
  if (rated.unknown.length) {
    total.addRow([])
    total.addRow([x.unknown]).font = { bold: true }
    for (const item of rated.unknown) total.addRow([item.name, item.count])
  }

  // Download
  const buffer = await book.xlsx.writeBuffer()
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  )
  const link = document.createElement("a")
  link.href = url
  link.download = options.fileName
  link.click()
  URL.revokeObjectURL(url)
}
