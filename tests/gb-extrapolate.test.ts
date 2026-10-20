import { describe, expect, it } from "vitest"
import { fitColumn, valueAt } from "@/core/gb-extrapolate"

// values[level], index 0 unused
const series = (fn: (level: number) => number, last = 80) =>
  Array.from({ length: last + 1 }, (_, level) => fn(level))

describe("Great Building extrapolation", () => {
  it("continues linear bonuses", () => {
    const values = series((l) => 10 + 5 * l)
    const model = fitColumn(values, 0)!
    expect(model).toEqual({ kind: "linear", step: 5 })
    expect(valueAt(model, values, 400)).toBe(10 + 5 * 400)
  })

  it("continues periodic steps", () => {
    // +1 every third level
    const values = series((l) => 12 + Math.floor(l / 3))
    const model = fitColumn(values, 0)!
    expect(model.kind).toBe("periodic")
    expect(valueAt(model, values, 99)).toBe(12 + 33)
  })

  it("finds the power law of the Colosseum happiness (4000 x sqrt(level / 10))", () => {
    const values = series((l) => (l < 10 ? l * 300 : Math.ceil(4000 * Math.sqrt(l / 10) - 1e-9)))
    const model = fitColumn(values, 0)!
    expect(model).toMatchObject({ kind: "power", k: 0.5, rounding: "ceil" })
    expect(valueAt(model, values, 160)).toBe(16000)
  })

  it("refuses columns no model reproduces", () => {
    const values = series((l) => (l <= 60 ? l : 60 + Math.sqrt(l - 60) * 7.3 + (l % 7)))
    expect(fitColumn(values, 2)).toBeUndefined()
  })
})
