import ExcelJS from "exceljs"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { CityRow, RatedCity } from "@/core/city"
import { score } from "@/core/efficiency"
import type { StatKey } from "@/core/stats"
import fr from "@/locales/fr.json"
import { exportCity } from "@/city/city-export"

const row = (name: string, stats: CityRow["stats"], tiles: number, count: number): CityRow => ({
  kind: "building",
  id: name,
  name: { fr: name, en: name },
  age: "IronAge",
  count,
  tiles,
  stats,
  score: 0,
})

// Writes the workbook through a stubbed download, then reads it back
async function exported(rated: RatedCity, scoreKeys: StatKey[]) {
  let blob: Blob | undefined
  vi.stubGlobal("URL", {
    createObjectURL: (b: Blob) => ((blob = b), "blob:x"),
    revokeObjectURL() {},
  })
  vi.stubGlobal("document", { createElement: () => ({ click() {} }) })
  const bases = { fp: 2000, goods: 1500, guild_goods: 500 }
  await exportCity({ rated, scoreKeys, bases, t: fr, locale: "fr", fileName: "x.xlsx" })
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(await blob!.arrayBuffer())
  return book
}

afterEach(() => vi.unstubAllGlobals())

describe("city export", () => {
  const keys: StatKey[] = ["fp", "goods", "fp_boost"]
  const bases = { fp: 2000, goods: 1500, guild_goods: 500 }
  const rows = [
    row("Forge", { fp: 20, goods: 10 }, 4, 2),
    row("Booster", { fp_boost: 5, goods: 30 }, 6, 1),
  ].map((r) => ({ ...r, score: score(r.stats, r.tiles, keys, undefined, bases) }))
  const rated = {
    rows,
    map: [],
    groups: [],
    traits: [],
    unknown: [{ name: "Hôtel de ville", count: 1 }],
  }

  it("gives each line a score formula that redoes the site's score", async () => {
    const book = await exported(rated, keys)
    const city = book.getWorksheet(fr.city.export.citySheet)!
    const factors = city.getRow(1)
    const header = city.getRow(2)
    expect(header.getCell(6).value).toBe(fr.city.export.score)
    for (let r = 3; r <= city.rowCount; r++) {
      const line = city.getRow(r)
      const cell = line.getCell(6).value as { formula: string; result: number }
      expect(cell.formula).toMatch(/^IF\(E\d+=0,0,SUMPRODUCT\(/)
      // SUMPRODUCT of the factors row (settings) and the stats, over the tiles
      let sum = 0
      for (let c = 7; c <= header.cellCount; c++) {
        const factor = (factors.getCell(c).value as { result: number }).result
        sum += factor * Number(line.getCell(c).value ?? 0)
      }
      const site = rows.find((x) => x.name.fr === line.getCell(1).value)!.score
      expect(sum / Number(line.getCell(5).value)).toBeCloseTo(site, 10)
      expect(cell.result).toBeCloseTo(site, 10)
    }
  })

  it("links the factors to the settings, and sums the city on the total sheet", async () => {
    const book = await exported(rated, keys)
    const settings = book.getWorksheet(fr.city.export.settingsSheet)!
    const formulas: string[] = []
    settings.eachRow((r) => {
      const value = r.getCell(5).value as { formula?: string } | null
      if (value?.formula) formulas.push(value.formula)
    })
    // A percent boost uses the base of the day and the reference of the stat it boosts
    expect(formulas.some((f) => /\$B\$\d+\/100\/B\d+/.test(f))).toBe(true)
    const city = book.getWorksheet(fr.city.export.citySheet)!
    expect((city.getRow(1).getCell(7).value as { formula: string }).formula).toContain(
      `'${fr.city.export.settingsSheet}'!E`,
    )
    const total = book.getWorksheet(fr.city.export.totalSheet)!
    const fp = [...Array(total.rowCount).keys()]
      .map((i) => total.getRow(i + 1))
      .find((r) => r.getCell(1).value === fr.statsFull.fp)!
    expect((fp.getCell(2).value as { result: number }).result).toBe(40)
    const names: unknown[] = []
    total.eachRow((r) => names.push(r.getCell(1).value))
    expect(names).toContain("Hôtel de ville")
  })
})
