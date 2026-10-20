import { describe, expect, it } from "vitest"
import { approxValueAt, fitApproximate } from "@/core/gb-extrapolate"

const levels = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

describe("approximate Great Building progression", () => {
  // A chance flattening out towards 100%
  const chance = levels(50, 136).map(
    (l) => [l, Math.round((100 - 60 * Math.exp(-l / 30)) * 100) / 100] as [number, number],
  )

  it("starts from the last known value and never goes down", () => {
    const model = fitApproximate(chance, 2, true)!
    expect(approxValueAt(model, 136)).toBe(chance.at(-1)![1])
    for (let level = 137; level < 400; level++) {
      expect(approxValueAt(model, level + 1)).toBeGreaterThanOrEqual(approxValueAt(model, level))
    }
  })

  it("keeps a chance at or below 100%", () => {
    const model = fitApproximate(chance, 2, true)!
    expect(model.form).toBe("exp")
    expect(approxValueAt(model, 400)).toBeLessThanOrEqual(100)
  })

  it("keeps counts growing ever slower", () => {
    const counts = levels(50, 117).map((l) => [l, Math.floor(l ** 0.5)] as [number, number])
    const model = fitApproximate(counts, 0, false)!
    expect(model.form).toBe("power")
    expect(approxValueAt(model, 400)).toBeGreaterThan(approxValueAt(model, 200))
    expect(approxValueAt(model, 400) - approxValueAt(model, 300)).toBeLessThanOrEqual(
      approxValueAt(model, 200) - approxValueAt(model, 117),
    )
  })

  it("needs at least 10 known levels from 50 on", () => {
    expect(
      fitApproximate(
        levels(1, 55).map((l) => [l, l]),
        0,
        false,
      ),
    ).toBeUndefined()
  })
})
