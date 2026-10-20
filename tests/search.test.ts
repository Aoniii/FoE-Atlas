import { describe, expect, it } from "vitest"
import { normalize, searchBuildings, type SearchEntry } from "@/core/search"

const entry = (id: string, fr: string, en: string): SearchEntry => ({ id, name: { fr, en } })

const entries = [
  entry("terrace_farm", "Cultures en terrasses", "Terrace Farm"),
  entry("terrace_farm_lv_2", "Cultures en terrasses - Niv. 2", "Terrace Farm - Lv. 2"),
  entry("eternal_market", "Marché éternel - Horizon toscan", "Eternal Market - Tuscan Horizon"),
  entry("ancient_temple", "Temple antique", "Ancient Temple"),
]
const ids = (query: string, locale = "fr") =>
  searchBuildings(entries, query, locale).map((e) => e.id)

describe("search", () => {
  it("ignores accents, case and punctuation", () => {
    expect(normalize("Marché Éternel - Horizon")).toBe("marche eternel horizon")
    expect(ids("MARCHE ETERNEL")).toEqual(["eternal_market"])
  })

  it("finds French and English names", () => {
    expect(ids("terrace")).toEqual(["terrace_farm", "terrace_farm_lv_2"])
    expect(ids("tuscan")).toEqual(["eternal_market"])
  })

  it("needs every word, in any order", () => {
    expect(ids("horizon marche")).toEqual(["eternal_market"])
    expect(ids("temple terrace")).toEqual([])
  })

  it("puts names starting with the query first", () => {
    expect(ids("temple")).toEqual(["ancient_temple"])
    expect(ids("terrasses niv")).toEqual(["terrace_farm_lv_2"])
  })

  it("returns nothing for an empty query", () => {
    expect(ids("  ")).toEqual([])
  })
})
