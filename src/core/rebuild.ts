// Rebuilds a city on its unlocked land with as few roads as possible and no useless hole.
// The town hall stays where it is and no building turns (the game does not turn them); a
// chain start with its links, or set buildings touching, move as one piece (their bonuses
// depend on where they stand to each other).
// Roads: a trunk along one side of the town hall (two lanes, in 2x2 blocks, when a building
// needs them) and streets across it, buildings on both sides. The pieces needing a road are
// placed first, two-lane ones nearest the town hall, the others biggest first where they
// touch the most; every road no building needs is then removed (two-lane blocks become
// one-lane roads where they can) and the pieces without a road fill the land left.
// Search: evenly spaced streets first, then a simulated annealing moving, adding and
// removing streets and swapping pieces in the placing order, for the time given; every plan
// is built in full, and the one leaving the fewest buildings out, then using the fewest
// roads, wins.

import type { City, MapRect, RoadLevel } from "./city"

// One building of a piece: its entity, offset from the piece's top-left, size and road
export type RebuildMember = {
  entity: number
  dx: number
  dy: number
  w: number
  h: number
  road: RoadLevel
}
export type RebuildPiece = { members: RebuildMember[] }

export type RebuildInput = {
  areas: MapRect[]
  townHall: MapRect
  pieces: RebuildPiece[]
}

export type RebuildResult = {
  // Entity index -> new top-left tile
  positions: Record<number, { x: number; y: number }>
  // Road tiles, one by one
  roads: (MapRect & { level: RoadLevel })[]
  // Entities left out (no room for them)
  unplaced: number[]
  roadTiles: number
  freeTiles: number
}

export type RebuildOptions = {
  // Time for the annealing (the even layouts and the finishing come on top)
  seconds?: number
  seed?: number
  // Share of the work done, 0 to 1
  onProgress?: (done: number) => void
}

// Cell states; a building cell holds its piece number + 1
const OUT = -1
const FREE = 0
const ROAD = -2
const ROAD2 = -3
const HALL = -4

const isRoad = (value: number) => value === ROAD || value === ROAD2

// A piece once its shape is known, in tiles from its top-left: the cells it covers, the
// cells around it, the members needing a road
type Shape = {
  piece: number
  cells: [number, number][]
  around: [number, number][]
  roadMembers: RebuildMember[]
  level: RoadLevel
  area: number
}

function shapeOf(piece: RebuildPiece, index: number): Shape {
  const covered = new Set<string>()
  const cells: [number, number][] = []
  for (const m of piece.members) {
    for (let x = m.dx; x < m.dx + m.w; x++) {
      for (let y = m.dy; y < m.dy + m.h; y++) {
        if (!covered.has(`${x},${y}`)) cells.push([x, y])
        covered.add(`${x},${y}`)
      }
    }
  }
  const around = new Map<string, [number, number]>()
  for (const [x, y] of cells) {
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (!covered.has(`${nx},${ny}`)) around.set(`${nx},${ny}`, [nx, ny])
    }
  }
  const roadMembers = piece.members.filter((m) => m.road > 0)
  return {
    piece: index,
    cells,
    around: [...around.values()],
    roadMembers,
    level: roadMembers.reduce<RoadLevel>((max, m) => (m.road > max ? m.road : max), 0),
    area: cells.length,
  }
}

// The problem in one frame, in tiles from the land's top-left: the trunk runs along y and
// the streets along x (the other frame swaps x and y)
type Frame = {
  width: number
  height: number
  // Land and town hall
  base: Int32Array
  hall: MapRect
  shapes: Shape[]
  pieces: RebuildPiece[]
  x0: number
  y0: number
  swap: boolean
}

function frameOf(input: RebuildInput, swap: boolean): Frame {
  const t = (r: MapRect): MapRect => (swap ? { x: r.y, y: r.x, w: r.h, h: r.w } : r)
  const areas = input.areas.map(t)
  const x0 = Math.min(...areas.map((a) => a.x))
  const y0 = Math.min(...areas.map((a) => a.y))
  const width = Math.max(...areas.map((a) => a.x + a.w)) - x0
  const height = Math.max(...areas.map((a) => a.y + a.h)) - y0
  const base = new Int32Array(width * height).fill(OUT)
  for (const a of areas) {
    for (let x = a.x - x0; x < a.x - x0 + a.w; x++) {
      for (let y = a.y - y0; y < a.y - y0 + a.h; y++) base[y * width + x] = FREE
    }
  }
  const townHall = t(input.townHall)
  const hall = { ...townHall, x: townHall.x - x0, y: townHall.y - y0 }
  for (let x = hall.x; x < hall.x + hall.w; x++) {
    for (let y = hall.y; y < hall.y + hall.h; y++) {
      if (x >= 0 && y >= 0 && x < width && y < height) base[y * width + x] = HALL
    }
  }
  const pieces = input.pieces.map((p) => ({
    members: p.members.map((m) => (swap ? { ...m, dx: m.dy, dy: m.dx, w: m.h, h: m.w } : { ...m })),
  }))
  return { width, height, base, hall, shapes: pieces.map(shapeOf), pieces, x0, y0, swap }
}

// Where the trunk goes (before or after the town hall) and the rows of the streets
// and the order the pieces needing a road are placed in (shape numbers; default: two-lane
// ones first, then the biggest)
type Layout = { side: 0 | 1; streets: number[]; order?: number[] }

const defaultOrder = (frame: Frame) =>
  frame.shapes
    .filter((s) => s.level > 0)
    .sort((a, b) => b.level - a.level || b.area - a.area)
    .map((s) => s.piece)

const PAD = 16

class Builder {
  readonly frame: Frame
  readonly cells: Int32Array
  readonly blocks: [number, number][]
  conn1 = new Uint8Array(0)
  conn2 = new Uint8Array(0)
  // Road tiles joined to the town hall, any road and two-lane roads
  roads1: number[] = []
  roads2: number[] = []
  placed: { shape: Shape; x: number; y: number }[] = []
  unplaced: Shape[] = []
  // Candidate spots already looked at for the piece being placed
  private readonly stamp: Int32Array
  private stampId = 0

  constructor(frame: Frame, layout: Layout, twoLanes: boolean) {
    this.frame = frame
    this.cells = frame.base.slice()
    this.blocks = this.layRoads(layout, twoLanes)
    this.stamp = new Int32Array((frame.width + 2 * PAD) * (frame.height + 2 * PAD))
    this.refresh()
    // Roads not joined to the town hall are no use
    for (let i = 0; i < this.cells.length; i++) {
      if (isRoad(this.cells[i]) && !this.conn1[i]) this.cells[i] = FREE
    }
  }

  at(x: number, y: number): number {
    const { width, height } = this.frame
    return x < 0 || y < 0 || x >= width || y >= height ? OUT : this.cells[y * width + x]
  }

  private layRoads(layout: Layout, twoLanes: boolean): [number, number][] {
    const { width, height, hall } = this.frame
    const lanes = twoLanes ? 2 : 1
    const tx = layout.side === 0 ? hall.x - lanes : hall.x + hall.w
    const blocks: [number, number][] = []
    if (twoLanes) {
      // 2x2 blocks lined up on the town hall's rows
      for (let y = hall.y - 2 * Math.ceil(hall.y / 2); y < height; y += 2) {
        const block = [
          [tx, y],
          [tx + 1, y],
          [tx, y + 1],
          [tx + 1, y + 1],
        ]
        if (!block.every(([x, yy]) => this.at(x, yy) === FREE)) continue
        for (const [x, yy] of block) this.cells[yy * width + x] = ROAD2
        blocks.push([tx, y])
      }
    } else {
      for (let y = 0; y < height; y++)
        if (this.at(tx, y) === FREE) this.cells[y * width + tx] = ROAD
    }
    for (const y of layout.streets) {
      if (y < 0 || y >= height) continue
      for (let x = 0; x < width; x++) if (this.at(x, y) === FREE) this.cells[y * width + x] = ROAD
    }
    return blocks
  }

  refresh() {
    const { width, height, hall } = this.frame
    const bfs = (level: 1 | 2) => {
      const seen = new Uint8Array(width * height)
      const list: number[] = []
      const ok = (v: number) => (level === 2 ? v === ROAD2 : isRoad(v))
      const visit = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return
        const i = y * width + x
        if (seen[i] || !ok(this.cells[i])) return
        seen[i] = 1
        list.push(i)
      }
      for (let x = hall.x; x < hall.x + hall.w; x++) {
        visit(x, hall.y - 1)
        visit(x, hall.y + hall.h)
      }
      for (let y = hall.y; y < hall.y + hall.h; y++) {
        visit(hall.x - 1, y)
        visit(hall.x + hall.w, y)
      }
      for (let k = 0; k < list.length; k++) {
        const x = list[k] % width
        const y = (list[k] - x) / width
        visit(x + 1, y)
        visit(x - 1, y)
        visit(x, y + 1)
        visit(x, y - 1)
      }
      return { seen, list }
    }
    const one = bfs(1)
    const two = bfs(2)
    this.conn1 = one.seen
    this.roads1 = one.list
    this.conn2 = two.seen
    this.roads2 = two.list
  }

  private joined(x: number, y: number, level: RoadLevel) {
    const { width, height } = this.frame
    if (x < 0 || y < 0 || x >= width || y >= height) return false
    return (level === 2 ? this.conn2 : this.conn1)[y * width + x] === 1
  }

  // Each member needing a road touches one joined to the town hall
  served(shape: Shape, px: number, py: number) {
    for (const m of shape.roadMembers) {
      const x = px + m.dx
      const y = py + m.dy
      let ok = false
      for (let i = x; i < x + m.w && !ok; i++) {
        ok = this.joined(i, y - 1, m.road) || this.joined(i, y + m.h, m.road)
      }
      for (let j = y; j < y + m.h && !ok; j++) {
        ok = this.joined(x - 1, j, m.road) || this.joined(x + m.w, j, m.road)
      }
      if (!ok) return false
    }
    return true
  }

  fits(shape: Shape, px: number, py: number) {
    for (const [dx, dy] of shape.cells) if (this.at(px + dx, py + dy) !== FREE) return false
    return true
  }

  // Cells around the piece already taken: the more, the tighter it sits
  contact(shape: Shape, px: number, py: number) {
    let count = 0
    for (const [dx, dy] of shape.around) if (this.at(px + dx, py + dy) !== FREE) count++
    return count
  }

  // Road tiles along the piece
  roadSides(shape: Shape, px: number, py: number) {
    let count = 0
    for (const [dx, dy] of shape.around) if (isRoad(this.at(px + dx, py + dy))) count++
    return count
  }

  distance(px: number, py: number) {
    const { hall } = this.frame
    return Math.abs(px - hall.x) + Math.abs(py - hall.y)
  }

  put(shape: Shape, px: number, py: number) {
    const { width } = this.frame
    for (const [dx, dy] of shape.cells) this.cells[(py + dy) * width + px + dx] = shape.piece + 1
    this.placed.push({ shape, x: px, y: py })
  }

  // Best spot touching a road for a piece needing one: two-lane pieces nearest the town
  // hall (the two-lane roads stay short), the others tightest, then nearest
  placeServed(shape: Shape): boolean {
    const { width } = this.frame
    const anchor = shape.roadMembers.find((m) => m.road === shape.level)!
    const stride = width + 2 * PAD
    this.stampId++
    let best = -Infinity
    let bx = 0
    let by = 0
    const consider = (mx: number, my: number) => {
      const px = mx - anchor.dx
      const py = my - anchor.dy
      if (px < -PAD || py < -PAD || px >= width + PAD) return
      const key = (py + PAD) * stride + px + PAD
      if (key >= this.stamp.length || this.stamp[key] === this.stampId) return
      this.stamp[key] = this.stampId
      if (!this.fits(shape, px, py) || !this.served(shape, px, py)) return
      const contact = this.contact(shape, px, py)
      const distance = this.distance(px, py)
      const score = shape.level === 2 ? contact - distance * 1000 : contact * 1000 - distance
      if (score > best) {
        best = score
        bx = px
        by = py
      }
    }
    const { w, h } = anchor
    for (const i of shape.level === 2 ? this.roads2 : this.roads1) {
      const rx = i % width
      const ry = (i - rx) / width
      for (let d = 0; d < w; d++) {
        consider(rx - d, ry + 1)
        consider(rx - d, ry - h)
      }
      for (let d = 0; d < h; d++) {
        consider(rx + 1, ry - d)
        consider(rx - w, ry - d)
      }
    }
    if (best === -Infinity) return false
    this.put(shape, bx, by)
    return true
  }

  // Best free spot anywhere for a piece without a road: tightest, then nearest
  // (`avoidRoads`: away from the roads, whose sides are for the pieces needing one)
  placeFree(shape: Shape, avoidRoads = false): boolean {
    const { width, height } = this.frame
    let best = -Infinity
    let bx = 0
    let by = 0
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        if (!this.fits(shape, px, py)) continue
        let score = this.contact(shape, px, py) * 1000 - this.distance(px, py)
        if (avoidRoads) score -= this.roadSides(shape, px, py) * 2000
        if (score > best) {
          best = score
          bx = px
          by = py
        }
      }
    }
    if (best === -Infinity) return false
    this.put(shape, bx, by)
    return true
  }

  allServed() {
    return this.placed.every((p) => this.served(p.shape, p.x, p.y))
  }

  roadCount() {
    let count = 0
    for (const v of this.cells) if (isRoad(v)) count++
    return count
  }

  // Roads left once the dead ends serving no building are cut: a quick estimate of prune()
  trimmedRoads() {
    const { width, height, hall } = this.frame
    const cells = this.cells.slice()
    const at = (x: number, y: number) =>
      x < 0 || y < 0 || x >= width || y >= height ? OUT : cells[y * width + x]
    const nextToHall = (x: number, y: number) =>
      x >= hall.x - 1 && x <= hall.x + hall.w && y >= hall.y - 1 && y <= hall.y + hall.h
    let stack: number[] = []
    for (let i = 0; i < cells.length; i++) if (isRoad(cells[i])) stack.push(i)
    let count = stack.length
    while (stack.length) {
      const next: number[] = []
      for (const i of stack) {
        if (!isRoad(cells[i])) continue
        const x = i % width
        const y = (i - x) / width
        let roads = 0
        let building = false
        for (const v of [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)]) {
          if (isRoad(v)) roads++
          else if (v > 0) building = true
        }
        if (roads > 1 || building || nextToHall(x, y)) continue
        cells[i] = FREE
        count--
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ]) {
          if (isRoad(at(nx, ny))) next.push(ny * width + nx)
        }
      }
      stack = next
    }
    return count
  }

  // Removes every road no building needs, farthest from the town hall first; a two-lane
  // block no building needs as such becomes four one-lane road tiles first
  prune() {
    const { width, hall } = this.frame
    const tryChange = (changes: [number, number][]) => {
      const before = changes.map(([i]) => this.cells[i])
      for (const [i, v] of changes) this.cells[i] = v
      this.refresh()
      if (this.allServed()) return true
      changes.forEach(([i], k) => (this.cells[i] = before[k]))
      this.refresh()
      return false
    }
    const far = (i: number) => {
      const x = i % width
      const y = (i - x) / width
      return Math.abs(x - hall.x - hall.w / 2) + Math.abs(y - hall.y - hall.h / 2)
    }
    for (let changed = true; changed;) {
      changed = false
      const blocks = this.blocks
        .map(([bx, by]) => [
          by * width + bx,
          by * width + bx + 1,
          (by + 1) * width + bx,
          (by + 1) * width + bx + 1,
        ])
        .filter((block) => this.cells[block[0]] === ROAD2)
        .sort((a, b) => far(b[0]) - far(a[0]))
      for (const block of blocks) {
        if (tryChange(block.map((i) => [i, FREE]))) changed = true
        else if (tryChange(block.map((i) => [i, ROAD]))) changed = true
      }
      const roads: number[] = []
      for (let i = 0; i < this.cells.length; i++) if (this.cells[i] === ROAD) roads.push(i)
      roads.sort((a, b) => far(b) - far(a))
      for (const i of roads) if (tryChange([[i, FREE]])) changed = true
    }
  }
}

const costOf = (unplaced: Shape[], roads: number) =>
  unplaced.reduce((sum, s) => sum + s.area, 0) * 10000 + roads

// First pass of a layout: its roads and the pieces needing one, with a quick cost
function sketch(frame: Frame, layout: Layout, twoLanes: boolean) {
  const builder = new Builder(frame, layout, twoLanes)
  for (const piece of layout.order ?? defaultOrder(frame)) {
    const shape = frame.shapes[piece]
    if (!builder.placeServed(shape)) builder.unplaced.push(shape)
  }
  // The big pieces without a road too, away from the roads: the holes left would not hold them
  for (const shape of bigFree(frame)) {
    if (!builder.placeFree(shape, true)) builder.unplaced.push(shape)
  }
  // Every road no building needs removed, then the small pieces in the holes left: the cost
  // is the plan's own
  builder.prune()
  for (const shape of smallFree(frame)) {
    if (!builder.placeFree(shape)) builder.unplaced.push(shape)
  }
  return { builder, cost: costOf(builder.unplaced, builder.roadCount()) }
}

// Pieces without a road placed with those needing one (the smaller ones fill the holes left)
const BIG = 6
const bigFree = (frame: Frame) =>
  frame.shapes.filter((s) => s.level === 0 && s.area >= BIG).sort((a, b) => b.area - a.area)
const smallFree = (frame: Frame) =>
  frame.shapes.filter((s) => s.level === 0 && s.area < BIG).sort((a, b) => b.area - a.area)

// Small seeded random generator: the same rebuild for the same city
function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const now = () => performance.now()

// Tries of an annealing round, per trunk
const ROUND = 150

// Time the city tab gives the search: past it, the plans found barely get better
export const REBUILD_SECONDS = 180

export function rebuildCity(input: RebuildInput, options: RebuildOptions = {}): RebuildResult {
  const { seconds = 60, seed = 1, onProgress } = options
  const rand = random(seed)
  const twoLanes = input.pieces.some((p) => p.members.some((m) => m.road === 2))
  const frames = [frameOf(input, false), frameOf(input, true)]
  // One search per trunk: before or after the town hall, in each frame
  const trunks = frames.flatMap((frame) => ([0, 1] as const).map((side) => ({ frame, side })))

  type Found = { frame: Frame; layout: Layout; cost: number }
  const found: Found[] = []
  const tryLayout = (frame: Frame, layout: Layout) => {
    const cost = sketch(frame, layout, twoLanes).cost
    found.push({ frame, layout, cost })
    return cost
  }

  // Evenly spaced streets
  const even = trunks.flatMap(({ frame, side }) =>
    [2, 3, 4, 5, 6, 7].flatMap((depth) =>
      Array.from({ length: 2 * depth + 1 }, (_, offset) => {
        const streets: number[] = []
        for (let y = offset; y < frame.height; y += 2 * depth + 1) streets.push(y)
        return { frame, layout: { side, streets } }
      }),
    ),
  )
  even.forEach(({ frame, layout }, i) => {
    tryLayout(frame, layout)
    onProgress?.((0.2 * (i + 1)) / even.length)
  })

  // Annealing by rounds of a set number of tries, taking the trunks in turn, each round
  // starting again from the best plan of its trunk: the tries never depend on the time, so
  // more time only adds tries and never gives a worse plan
  type State = { streets: number[]; order: number[]; cost: number }
  const states = trunks.map(({ frame, side }) => {
    const own = found
      .filter((f) => f.frame === frame && f.layout.side === side)
      .reduce((a, b) => (b.cost < a.cost ? b : a))
    const order = own.layout.order ?? defaultOrder(frame)
    const state: State = { streets: [...own.layout.streets], order, cost: own.cost }
    return {
      current: state,
      best: state,
      // Two-lane pieces stay first
      firstFree: order.filter((p) => frame.shapes[p].level === 2).length,
    }
  })
  const budget = seconds * 1000
  const annealStart = now()
  for (let step = 0; now() - annealStart < budget; step++) {
    const t = step % trunks.length
    const { frame, side } = trunks[t]
    const run = states[t]
    const tryInRound = Math.floor(step / trunks.length) % ROUND
    if (tryInRound === 0) run.current = run.best
    const temperature = 8 * (1 - tryInRound / ROUND) + 0.3
    const { streets, order, cost } = run.current
    const next = [...streets]
    let nextOrder = order
    const move = rand()
    if (move < 0.35 && order.length - run.firstFree > 1) {
      // Two pieces placed in the other order
      nextOrder = [...order]
      const a = run.firstFree + Math.floor(rand() * (order.length - run.firstFree))
      const b = run.firstFree + Math.floor(rand() * (order.length - run.firstFree))
      ;[nextOrder[a], nextOrder[b]] = [nextOrder[b], nextOrder[a]]
    } else if (move < 0.75 && next.length) {
      next[Math.floor(rand() * next.length)] += rand() < 0.5 ? -1 : 1
    } else if (move < 0.88 || !next.length) {
      next.push(Math.floor(rand() * frame.height))
    } else {
      next.splice(Math.floor(rand() * next.length), 1)
    }
    const unique = [...new Set(next)].sort((a, b) => a - b)
    const nextCost = sketch(frame, { side, streets: unique, order: nextOrder }, twoLanes).cost
    if (nextCost <= cost || rand() < Math.exp((cost - nextCost) / temperature)) {
      run.current = { streets: unique, order: nextOrder, cost: nextCost }
      if (nextCost < run.best.cost) run.best = run.current
    }
    onProgress?.(0.2 + (0.8 * Math.min(budget, now() - annealStart)) / budget)
  }

  // The best plan found, built again
  const winner = states.reduce((a, b) => (b.best.cost < a.best.cost ? b : a))
  const { frame: bestFrame, side: bestSide } = trunks[states.indexOf(winner)]
  const best = sketch(
    bestFrame,
    { side: bestSide, streets: winner.best.streets, order: winner.best.order },
    twoLanes,
  )
  onProgress?.(1)

  const { builder } = best
  const { frame } = builder
  const back = (x: number, y: number) => {
    const fx = x + frame.x0
    const fy = y + frame.y0
    return frame.swap ? { x: fy, y: fx } : { x: fx, y: fy }
  }
  const positions: RebuildResult["positions"] = {}
  for (const { shape, x, y } of builder.placed) {
    for (const m of frame.pieces[shape.piece].members) {
      positions[m.entity] = back(x + m.dx, y + m.dy)
    }
  }
  const roads: RebuildResult["roads"] = []
  let freeTiles = 0
  builder.cells.forEach((value, i) => {
    if (value === FREE) freeTiles++
    if (!isRoad(value)) return
    const x = i % frame.width
    const y = (i - x) / frame.width
    roads.push({ ...back(x, y), w: 1, h: 1, level: value === ROAD2 ? 2 : 1 })
  })
  return {
    positions,
    roads,
    unplaced: builder.unplaced.flatMap((s) => frame.pieces[s.piece].members.map((m) => m.entity)),
    roadTiles: roads.length,
    freeTiles,
  }
}

// The problem for a city: its unlocked land, its town hall, its buildings as pieces (a group
// of `groups` keeps its members where they stand to each other). Undefined when the city was
// imported before sizes and roads were kept, or has no town hall
export function rebuildInput(city: City, groups: number[][]): RebuildInput | undefined {
  const hall = city.entities.find((e) => e.type === "main_building")
  if (!city.areas?.length || !hall?.w || !hall.h) return undefined
  // Imported before the roads buildings need were kept
  if (city.entities.some((e) => e.w && e.road === undefined)) return undefined
  const inGroup = new Set(groups.flat())
  const single = city.entities.flatMap((_, i) => (inGroup.has(i) ? [] : [[i]]))
  const pieces: RebuildPiece[] = []
  for (const group of [...groups, ...single]) {
    const entities = group.map((i) => ({ i, e: city.entities[i] }))
    if (entities.some(({ e }) => e === hall || !e.w || !e.h || e.road === undefined)) continue
    const x = Math.min(...entities.map(({ e }) => e.x))
    const y = Math.min(...entities.map(({ e }) => e.y))
    pieces.push({
      members: entities.map(({ i, e }) => ({
        entity: i,
        dx: e.x - x,
        dy: e.y - y,
        w: e.w!,
        h: e.h!,
        road: e.road!,
      })),
    })
  }
  return { areas: city.areas, townHall: { x: hall.x, y: hall.y, w: hall.w, h: hall.h }, pieces }
}

// The city moved to the rebuilt plan: buildings at their new place (those left out removed),
// the new roads
export function rebuiltCity(city: City, result: RebuildResult): City {
  return {
    ...city,
    entities: city.entities.flatMap((entity, i) => {
      if (entity.type === "main_building") return [entity]
      const position = result.positions[i]
      return position ? [{ ...entity, ...position }] : []
    }),
    streets: result.roads.map(({ level, ...road }) => ({ ...road, ...(level === 2 && { level }) })),
  }
}

// Road and free tiles of a city
export function tileCounts(city: City) {
  const land = (city.areas ?? []).reduce((sum, a) => sum + a.w * a.h, 0)
  const roads = (city.streets ?? []).reduce((sum, s) => sum + s.w * s.h, 0)
  const taken = city.entities.reduce((sum, e) => sum + (e.w ?? 0) * (e.h ?? 0), 0)
  return { roads, free: land - roads - taken }
}
