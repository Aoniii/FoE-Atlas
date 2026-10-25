import { describe, expect, it } from "vitest"
import { rebuildCity, type RebuildInput, type RebuildResult } from "@/core/rebuild"

const piece = (entity: number, w: number, h: number, road: 0 | 1 | 2) => ({
  members: [{ entity, dx: 0, dy: 0, w, h, road }],
})

// Checks a plan the way the game would: buildings on the land, apart, each needing a road
// touching one joined to the town hall (two-lane ones through two-lane roads only)
function check(input: RebuildInput, result: RebuildResult) {
  const key = (x: number, y: number) => `${x},${y}`
  const land = new Set<string>()
  for (const a of input.areas) {
    for (let x = a.x; x < a.x + a.w; x++) for (let y = a.y; y < a.y + a.h; y++) land.add(key(x, y))
  }
  const taken = new Map<string, string>()
  const take = (x: number, y: number, what: string) => {
    expect(land.has(key(x, y)), `${what} on the land at ${key(x, y)}`).toBe(true)
    expect(taken.has(key(x, y)), `${what} over ${taken.get(key(x, y))} at ${key(x, y)}`).toBe(false)
    taken.set(key(x, y), what)
  }
  const hall = input.townHall
  for (let x = hall.x; x < hall.x + hall.w; x++) {
    for (let y = hall.y; y < hall.y + hall.h; y++) take(x, y, "hall")
  }
  const level = new Map<string, number>()
  for (const road of result.roads) {
    take(road.x, road.y, "road")
    level.set(key(road.x, road.y), road.level)
  }
  // Roads joined to the town hall, through roads of at least `min` lanes
  const joined = (min: number) => {
    const seen = new Set<string>()
    const queue: [number, number][] = []
    const visit = (x: number, y: number) => {
      if ((level.get(key(x, y)) ?? 0) < min || seen.has(key(x, y))) return
      seen.add(key(x, y))
      queue.push([x, y])
    }
    for (let x = hall.x; x < hall.x + hall.w; x++) {
      visit(x, hall.y - 1)
      visit(x, hall.y + hall.h)
    }
    for (let y = hall.y; y < hall.y + hall.h; y++) {
      visit(hall.x - 1, y)
      visit(hall.x + hall.w, y)
    }
    while (queue.length) {
      const [x, y] = queue.pop()!
      visit(x + 1, y)
      visit(x - 1, y)
      visit(x, y + 1)
      visit(x, y - 1)
    }
    return seen
  }
  const reach = [new Set<string>(), joined(1), joined(2)]
  for (const p of input.pieces) {
    for (const m of p.members) {
      const at = result.positions[m.entity]
      if (!at) continue
      for (let x = at.x; x < at.x + m.w; x++) {
        for (let y = at.y; y < at.y + m.h; y++) take(x, y, `building ${m.entity}`)
      }
      if (!m.road) continue
      const sides: [number, number][] = []
      for (let x = at.x; x < at.x + m.w; x++) sides.push([x, at.y - 1], [x, at.y + m.h])
      for (let y = at.y; y < at.y + m.h; y++) sides.push([at.x - 1, y], [at.x + m.w, y])
      expect(
        sides.some(([x, y]) => reach[m.road].has(key(x, y))),
        `building ${m.entity} served`,
      ).toBe(true)
    }
  }
}

describe("city rebuild", () => {
  const areas = [{ x: 0, y: 0, w: 12, h: 12 }]
  const townHall = { x: 0, y: 0, w: 3, h: 3 }

  it("serves every building needing a road, apart, on the land", () => {
    const input: RebuildInput = {
      areas,
      townHall,
      pieces: [
        piece(1, 3, 3, 1),
        piece(2, 3, 3, 1),
        piece(3, 2, 4, 1),
        piece(4, 4, 2, 1),
        piece(5, 1, 1, 0),
        piece(6, 2, 2, 0),
      ],
    }
    const result = rebuildCity(input, { seconds: 0.2 })
    expect(result.unplaced).toEqual([])
    check(input, result)
    // A road per building at most, well under the land
    expect(result.roadTiles).toBeLessThan(25)
  })

  it("joins two-lane buildings through 2x2 blocks of two-lane roads", () => {
    const input: RebuildInput = {
      areas,
      townHall,
      pieces: [piece(1, 2, 2, 2), piece(2, 3, 3, 1), piece(3, 3, 3, 1)],
    }
    const result = rebuildCity(input, { seconds: 0.2 })
    expect(result.unplaced).toEqual([])
    check(input, result)
    const two = new Set(result.roads.filter((r) => r.level === 2).map((r) => `${r.x},${r.y}`))
    expect(two.size % 4).toBe(0)
  })

  it("moves a chain or a set as one piece", () => {
    const input: RebuildInput = {
      areas,
      townHall,
      pieces: [
        {
          members: [
            { entity: 1, dx: 0, dy: 0, w: 2, h: 2, road: 1 },
            { entity: 2, dx: 2, dy: 0, w: 1, h: 1, road: 0 },
            { entity: 3, dx: 2, dy: 1, w: 1, h: 1, road: 0 },
          ],
        },
        piece(4, 3, 3, 1),
      ],
    }
    const result = rebuildCity(input, { seconds: 0.2 })
    check(input, result)
    const { positions: p } = result
    expect([p[2].x - p[1].x, p[2].y - p[1].y, p[3].x - p[1].x, p[3].y - p[1].y]).toEqual([
      2, 0, 2, 1,
    ])
  })

  it("leaves out what the land cannot hold", () => {
    const input: RebuildInput = {
      areas: [{ x: 0, y: 0, w: 5, h: 5 }],
      townHall,
      pieces: [piece(1, 4, 4, 1)],
    }
    expect(rebuildCity(input, { seconds: 0.1 }).unplaced).toEqual([1])
  })
})
