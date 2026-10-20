import { describe, expect, it } from "vitest"
import { scoreColor } from "@/wiki/format"

describe("score color", () => {
  it("follows the rainbow from violet (0) to blue (10)", () => {
    expect(scoreColor(0).background).toBe("hsl(280 75% 50%)")
    expect(scoreColor(2).background).toBe("hsl(0 75% 50%)")
    expect(scoreColor(6).background).toBe("hsl(55 75% 50%)")
    expect(scoreColor(10).background).toBe("hsl(220 75% 50%)")
  })

  it("stays blue above 10 and violet below 0", () => {
    expect(scoreColor(25)).toEqual(scoreColor(10))
    expect(scoreColor(-3)).toEqual(scoreColor(0))
  })

  it("picks the most readable text color", () => {
    expect(scoreColor(0).foreground).toBe("#fff") // violet
    expect(scoreColor(6).foreground).toBe("#000") // yellow
    expect(scoreColor(8).foreground).toBe("#000") // green
  })
})
