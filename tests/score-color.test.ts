import { describe, expect, it } from "vitest"
import { scoreColor } from "@/wiki/format"

describe("score color", () => {
  it("follows the rainbow from violet (0) to blue (10)", () => {
    expect(scoreColor(0)).toBe("hsl(280 75% 42%)")
    expect(scoreColor(2)).toBe("hsl(0 75% 42%)")
    expect(scoreColor(6)).toBe("hsl(55 75% 42%)")
    expect(scoreColor(10)).toBe("hsl(220 75% 42%)")
  })

  it("stays blue above 10 and violet below 0", () => {
    expect(scoreColor(25)).toBe(scoreColor(10))
    expect(scoreColor(-3)).toBe(scoreColor(0))
  })
})
