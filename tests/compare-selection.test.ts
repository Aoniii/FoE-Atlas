import { beforeEach, describe, expect, it } from "vitest"
import {
  MAX_COMPARE,
  clearCompare,
  isSelected,
  removeCompare,
  toggleCompare,
} from "@/compare/selection"

const item = (id: string, kind: "building" | "great_building" = "building") => ({
  kind,
  id,
  name: { fr: id, en: id },
})
describe("compare selection", () => {
  beforeEach(() => clearCompare())

  it("toggles items", () => {
    toggleCompare(item("a"))
    expect(isSelected("building", "a")).toBe(true)
    toggleCompare(item("a"))
    expect(isSelected("building", "a")).toBe(false)
  })

  it(`keeps at most ${MAX_COMPARE} items, dropping the oldest`, () => {
    for (const id of ["a", "b", "c", "d", "e"]) toggleCompare(item(id))
    expect(isSelected("building", "a")).toBe(false)
    expect(isSelected("building", "e")).toBe(true)
  })

  it("starts a new selection for another kind", () => {
    toggleCompare(item("a"))
    toggleCompare(item("arc", "great_building"))
    expect(isSelected("building", "a")).toBe(false)
    expect(isSelected("great_building", "arc")).toBe(true)
  })

  it("removes one item", () => {
    toggleCompare(item("a"))
    toggleCompare(item("b"))
    removeCompare("building", "a")
    expect(isSelected("building", "a")).toBe(false)
    expect(isSelected("building", "b")).toBe(true)
  })
})
