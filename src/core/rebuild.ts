// Rebuilds a city on its unlocked land: as few roads as possible, and the free land left
// gathered in one block for a new building. The town hall stays where it is and no building
// turns (the game does not turn them); a chain start with its links, or set buildings
// touching, move as one piece (their bonuses depend on where they stand to each other).
// The method of road-network city optimizers (simulated annealing over the places of the
// buildings needing a road, the roads routed again for each try):
// - roads: two-lane buildings first, joined to the town hall by a chain of 2x2 two-lane
//   blocks; then, again and again, the building nearest the road network is joined to it by
//   a shortest path (breadth-first search), a greedy Steiner tree;
// - annealing: from the city as it is, a building is moved near its place or near the town
//   hall, or two of the same outline swap places; a try is kept when it does not cost roads
//   (sometimes even when it does, less and less often). Rounds of a set number of tries,
//   each starting again from the best plan: more time only adds tries;
// - the buildings without a road go last: they never touch the roads, so the free land left
//   only depends on them. The biggest free block that still leaves room for all of them is
//   kept free, the same buildings side by side.

import type { City, MapRect, RoadLevel } from "./city"

// One building of a piece: its entity, offset from the piece's top-left, size and road
export type RebuildMember = {
  entity: number
  dx: number
  dy: number
  w: number
  h: number
  road: RoadLevel
  // Which building it is (the game's id): the same ones are placed side by side
  kind?: string
}
// A building, or buildings kept together; `at`: where it stands now (its top-left)
export type RebuildPiece = { members: RebuildMember[]; at?: { x: number; y: number } }

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
  // Biggest free block at least FREE_SIDE tiles on each side, room for a new building
  freeRect?: MapRect
}

export type RebuildOptions = {
  seconds?: number
  seed?: number
  // Share of the work done, 0 to 1
  onProgress?: (done: number) => void
}

// Smallest side of the free block kept for a new building
export const FREE_SIDE = 4
// Time the city tab gives the search by default
export const REBUILD_SECONDS = 180

// Tries of an annealing round, and its temperature from start to end (in roads)
const ROUND = 4000
const HOT = 3
const COLD = 0.05
// Share of the time for the free block
const GATHER_SHARE = 0.15

// Cell states; a building cell holds its piece number + 1
const OUT = -1
const FREE = 0
const ROAD = -2
const ROAD2 = -3
const HALL = -4
const RESERVED = -5

const isRoad = (value: number) => value === ROAD || value === ROAD2

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

// A piece once its shape is known, in tiles from its top-left: the cells it covers, the
// cells around it, the members needing a road
type Shape = {
  piece: number
  cells: [number, number][]
  around: [number, number][]
  roadMembers: RebuildMember[]
  level: RoadLevel
  area: number
  // The buildings it holds, the same for the same buildings
  kind: string
  // Same outline, same signature: such pieces can swap places
  outline: string
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
    for (const [dx, dy] of NEIGHBOURS) {
      const key = `${x + dx},${y + dy}`
      if (!covered.has(key)) around.set(key, [x + dx, y + dy])
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
    kind: piece.members.map((m) => m.kind ?? "").join("+"),
    outline: [...covered].sort().join(";"),
  }
}

// Biggest first, the same buildings one after the other
const byArea = (a: Shape, b: Shape) => b.area - a.area || a.kind.localeCompare(b.kind)

// The problem in tiles from the land's top-left
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
}

function frameOf(input: RebuildInput): Frame {
  const { areas } = input
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
  const hall = { ...input.townHall, x: input.townHall.x - x0, y: input.townHall.y - y0 }
  for (let x = hall.x; x < hall.x + hall.w; x++) {
    for (let y = hall.y; y < hall.y + hall.h; y++) {
      if (x >= 0 && y >= 0 && x < width && y < height) base[y * width + x] = HALL
    }
  }
  const pieces = input.pieces.map((p) => ({
    members: p.members.map((m) => ({ ...m })),
    ...(p.at && { at: { x: p.at.x - x0, y: p.at.y - y0 } }),
  }))
  return { width, height, base, hall, shapes: pieces.map(shapeOf), pieces, x0, y0 }
}

// A plan being built: the cells, the pieces placed, the roads
class Plan {
  readonly frame: Frame
  readonly cells: Int32Array
  placed: { shape: Shape; x: number; y: number }[] = []
  unplaced: Shape[] = []
  // Two-lane blocks laid, their four tiles each
  blocks: number[][] = []
  // Members needing a road that no road reaches
  unreachable = 0
  conn1: Uint8Array = new Uint8Array(0)
  conn2: Uint8Array = new Uint8Array(0)
  // How the 2x2 blocks line up (tiles from the land's top-left, 0 or 1 each way): chosen by
  // the first two-lane road, kept by the others so that they join
  private lineUp?: [number, number]

  constructor(frame: Frame) {
    this.frame = frame
    this.cells = frame.base.slice()
  }

  at(x: number, y: number): number {
    const { width, height } = this.frame
    return x < 0 || y < 0 || x >= width || y >= height ? OUT : this.cells[y * width + x]
  }

  fits(shape: Shape, px: number, py: number) {
    for (const [dx, dy] of shape.cells) if (this.at(px + dx, py + dy) !== FREE) return false
    return true
  }

  put(shape: Shape, px: number, py: number) {
    const { width } = this.frame
    for (const [dx, dy] of shape.cells) this.cells[(py + dy) * width + px + dx] = shape.piece + 1
    this.placed.push({ shape, x: px, y: py })
  }

  // Cells around the piece already taken: the more, the tighter it sits
  contact(shape: Shape, px: number, py: number) {
    let count = 0
    for (const [dx, dy] of shape.around) if (this.at(px + dx, py + dy) !== FREE) count++
    return count
  }

  // Pieces of the same buildings along this one
  twins(shape: Shape, px: number, py: number) {
    let count = 0
    for (const [dx, dy] of shape.around) {
      const v = this.at(px + dx, py + dy)
      if (v > 0 && this.frame.shapes[v - 1].kind === shape.kind) count++
    }
    return count
  }

  // Side tiles of a member placed at (px, py), inside the land's frame
  private sides(m: RebuildMember, px: number, py: number): number[] {
    const { width, height } = this.frame
    const x = px + m.dx
    const y = py + m.dy
    const out: number[] = []
    const add = (cx: number, cy: number) => {
      if (cx >= 0 && cy >= 0 && cx < width && cy < height) out.push(cy * width + cx)
    }
    for (let i = x; i < x + m.w; i++) {
      add(i, y - 1)
      add(i, y + m.h)
    }
    for (let j = y; j < y + m.h; j++) {
      add(x - 1, j)
      add(x + m.w, j)
    }
    return out
  }

  private hallSides(): number[] {
    const { width, height, hall } = this.frame
    const out: number[] = []
    const add = (x: number, y: number) => {
      if (x >= 0 && y >= 0 && x < width && y < height) out.push(y * width + x)
    }
    for (let x = hall.x; x < hall.x + hall.w; x++) {
      add(x, hall.y - 1)
      add(x, hall.y + hall.h)
    }
    for (let y = hall.y; y < hall.y + hall.h; y++) {
      add(hall.x - 1, y)
      add(hall.x + hall.w, y)
    }
    return out
  }

  // Road tiles joined to the town hall: any road (level 1) or two-lane roads only (level 2)
  private joined(level: 1 | 2): Uint8Array {
    const { width, height } = this.frame
    const seen = new Uint8Array(width * height)
    const list: number[] = []
    const ok = (v: number) => (level === 2 ? v === ROAD2 : isRoad(v))
    const visit = (i: number) => {
      if (seen[i] || !ok(this.cells[i])) return
      seen[i] = 1
      list.push(i)
    }
    for (const i of this.hallSides()) visit(i)
    for (let k = 0; k < list.length; k++) {
      const x = list[k] % width
      const y = (list[k] - x) / width
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) visit(ny * width + nx)
      }
    }
    return seen
  }

  refresh() {
    this.conn1 = this.joined(1)
    this.conn2 = this.joined(2)
  }

  // Each member needing a road touches one joined to the town hall
  served(shape: Shape, px: number, py: number) {
    return shape.roadMembers.every((m) => {
      const conn = m.road === 2 ? this.conn2 : this.conn1
      return this.sides(m, px, py).some((i) => conn[i] === 1)
    })
  }

  allServed() {
    return this.placed.every((p) => this.served(p.shape, p.x, p.y))
  }

  // Lays the roads of the pieces placed: two-lane chains of 2x2 blocks first, then the
  // member nearest the network joined to it by a shortest path, again and again
  route() {
    const { width, height, hall } = this.frame
    type Need = { sides: number[]; level: RoadLevel; distance: number }
    const needs: Need[] = []
    for (const { shape, x, y } of this.placed) {
      for (const m of shape.roadMembers) {
        const distance = Math.abs(x + m.dx - hall.x) + Math.abs(y + m.dy - hall.y)
        needs.push({ sides: this.sides(m, x, y), level: m.road, distance })
      }
    }
    const twoLanes = needs.filter((n) => n.level === 2).sort((a, b) => a.distance - b.distance)
    for (const need of twoLanes) if (!this.routeTwoLanes(need.sides)) this.unreachable++

    // One lane: a search from the whole network (and the town hall's sides) at once
    const pending = needs.filter((n) => n.level === 1)
    const prev = new Int32Array(width * height)
    const target = new Uint8Array(width * height)
    const UNSEEN = -3
    for (;;) {
      this.conn1 = this.joined(1)
      for (let k = pending.length - 1; k >= 0; k--) {
        if (pending[k].sides.some((i) => this.conn1[i])) pending.splice(k, 1)
      }
      if (!pending.length) return
      target.fill(0)
      for (const need of pending) {
        for (const i of need.sides) if (this.cells[i] === FREE) target[i] = 1
      }
      prev.fill(UNSEEN)
      const queue: number[] = []
      for (let i = 0; i < this.conn1.length; i++) {
        if (!this.conn1[i]) continue
        prev[i] = -1
        queue.push(i)
      }
      for (const i of this.hallSides()) {
        if (this.cells[i] !== FREE || prev[i] !== UNSEEN) continue
        prev[i] = -1
        queue.push(i)
      }
      let found = -1
      for (let k = 0; k < queue.length; k++) {
        const i = queue[k]
        if (this.cells[i] === FREE && target[i]) {
          found = i
          break
        }
        const x = i % width
        const y = (i - x) / width
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const n = ny * width + nx
          if (prev[n] !== UNSEEN || this.cells[n] !== FREE) continue
          prev[n] = i
          queue.push(n)
        }
      }
      if (found < 0) {
        this.unreachable += pending.length
        return
      }
      for (let i = found; i >= 0 && this.cells[i] === FREE; i = prev[i]) this.cells[i] = ROAD
    }
  }

  // Joins a two-lane member to the town hall by a chain of 2x2 blocks, lined up the way
  // that needs the fewest
  private routeTwoLanes(sides: number[]): boolean {
    const ways: [number, number][] = this.lineUp
      ? [this.lineUp]
      : [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]
    const paths = ways.flatMap((way) => {
      const path = this.twoLanePath(sides, way)
      return path ? [{ way, path }] : []
    })
    if (!paths.length) return false
    const { way, path } = paths.reduce((a, b) => (b.path.length < a.path.length ? b : a))
    this.lineUp = way
    for (const block of path) {
      for (const i of block) this.cells[i] = ROAD2
      this.blocks.push(block)
    }
    return true
  }

  // Blocks to lay, lined up as `way`, from the town hall (or the two-lane roads) to the member
  private twoLanePath(sides: number[], [ox, oy]: [number, number]): number[][] | undefined {
    const { width, height } = this.frame
    const cols = Math.floor((width - ox) / 2)
    const rows = Math.floor((height - oy) / 2)
    const tiles = (b: number) => {
      const bx = ox + 2 * (b % cols)
      const by = oy + 2 * Math.floor(b / cols)
      return [
        by * width + bx,
        by * width + bx + 1,
        (by + 1) * width + bx,
        (by + 1) * width + bx + 1,
      ]
    }
    const open = (b: number) =>
      tiles(b).every((i) => this.cells[i] === FREE || this.cells[i] === ROAD2)
    const laid = (b: number) => tiles(b).every((i) => this.cells[i] === ROAD2)
    const hallSides = new Set(this.hallSides())
    const sideSet = new Set(sides)
    const prev = new Int32Array(cols * rows).fill(-3)
    const queue: number[] = []
    for (let b = 0; b < cols * rows; b++) {
      if (open(b) && (laid(b) || tiles(b).some((i) => hallSides.has(i)))) {
        prev[b] = -1
        queue.push(b)
      }
    }
    for (let k = 0; k < queue.length; k++) {
      const b = queue[k]
      if (tiles(b).some((i) => sideSet.has(i))) {
        const path: number[][] = []
        for (let c = b; c >= 0; c = prev[c]) if (!laid(c)) path.push(tiles(c))
        return path
      }
      const bx = b % cols
      const by = Math.floor(b / cols)
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = bx + dx
        const ny = by + dy
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
        const n = ny * cols + nx
        if (prev[n] !== -3 || !open(n)) continue
        prev[n] = b
        queue.push(n)
      }
    }
    return undefined
  }

  // Removes every road no building needs, farthest from the town hall first; a two-lane
  // block no building needs as such becomes four one-lane road tiles first
  prune() {
    const { width, hall } = this.frame
    this.refresh()
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

  // Best free spot for a piece without a road: tightest, then beside the same buildings,
  // then nearest the town hall
  placeFree(shape: Shape): boolean {
    const { width, height, hall } = this.frame
    let best = -Infinity
    let bx = 0
    let by = 0
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        if (!this.fits(shape, px, py)) continue
        const score =
          this.contact(shape, px, py) * 100000 +
          this.twins(shape, px, py) * 1000 -
          (Math.abs(px - hall.x) + Math.abs(py - hall.y))
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

  // Rectangles of free tiles with both sides at least FREE_SIDE, biggest first (every
  // maximal rectangle comes out of the row histograms)
  freeRects(): MapRect[] {
    const { width, height } = this.frame
    const heights = new Int32Array(width)
    const found = new Map<string, MapRect>()
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        heights[x] = this.cells[y * width + x] === FREE ? heights[x] + 1 : 0
      }
      const stack: number[] = []
      for (let x = 0; x <= width; x++) {
        const h = x < width ? heights[x] : 0
        while (stack.length && heights[stack[stack.length - 1]] >= h) {
          const rh = heights[stack.pop()!]
          const left = stack.length ? stack[stack.length - 1] + 1 : 0
          const rw = x - left
          if (rw >= FREE_SIDE && rh >= FREE_SIDE) {
            found.set(`${left},${y - rh + 1},${rw},${rh}`, { x: left, y: y - rh + 1, w: rw, h: rh })
          }
        }
        stack.push(x)
      }
    }
    return [...found.values()].sort((a, b) => b.w * b.h - a.w * a.h)
  }

  count(state: number) {
    let n = 0
    for (const v of this.cells) if (v === state) n++
    return n
  }

  roadCount() {
    let n = 0
    for (const v of this.cells) if (isRoad(v)) n++
    return n
  }

  twinPairs() {
    return this.placed.reduce((sum, p) => sum + this.twins(p.shape, p.x, p.y), 0)
  }
}

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

export function rebuildCity(input: RebuildInput, options: RebuildOptions = {}): RebuildResult {
  const { seconds = REBUILD_SECONDS, seed = 1, onProgress } = options
  const rand = random(seed)
  const frame = frameOf(input)
  const { width, height, hall, shapes } = frame
  const served = shapes.filter((s) => s.level > 0)
  const loose = shapes.filter((s) => s.level === 0).sort(byArea)
  const looseArea = loose.reduce((sum, s) => sum + s.area, 0)
  // Big pieces without a road: each must still find room
  const bigLoose = loose.filter((s) => s.area >= 16)

  // Land tiles from the nearest to the town hall (walking on the land)
  const scan: number[] = []
  const seen = new Uint8Array(width * height)
  for (let x = hall.x - 1; x <= hall.x + hall.w; x++) {
    for (let y = hall.y - 1; y <= hall.y + hall.h; y++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue
      const i = y * width + x
      if (frame.base[i] !== FREE || seen[i]) continue
      seen[i] = 1
      scan.push(i)
    }
  }
  for (let k = 0; k < scan.length; k++) {
    const x = scan[k] % width
    const y = (scan[k] - x) / width
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const n = ny * width + nx
      if (seen[n] || frame.base[n] !== FREE) continue
      seen[n] = 1
      scan.push(n)
    }
  }

  // State: where each piece needing a road stands, and the tiles they take
  const px = new Int32Array(shapes.length)
  const py = new Int32Array(shapes.length)
  const occupied = new Int32Array(width * height)
  const fitsAt = (shape: Shape, x: number, y: number) =>
    shape.cells.every(([dx, dy]) => {
      const cx = x + dx
      const cy = y + dy
      if (cx < 0 || cy < 0 || cx >= width || cy >= height) return false
      const i = cy * width + cx
      return frame.base[i] === FREE && (occupied[i] === 0 || occupied[i] === shape.piece + 1)
    })
  const mark = (shape: Shape, x: number, y: number, value: number) => {
    for (const [dx, dy] of shape.cells) occupied[(y + dy) * width + x + dx] = value
  }
  // Where the city stands now, else the first room from the town hall
  const placedServed: Shape[] = []
  const leftOut: Shape[] = []
  for (const shape of [...served].sort((a, b) => b.level - a.level || byArea(a, b))) {
    const at = frame.pieces[shape.piece].at
    let spot = at && fitsAt(shape, at.x, at.y) ? at : undefined
    for (let k = 0; !spot && k < scan.length; k++) {
      const x = scan[k] % width
      const y = (scan[k] - x) / width
      if (fitsAt(shape, x, y)) spot = { x, y }
    }
    if (!spot) {
      leftOut.push(shape)
      continue
    }
    px[shape.piece] = spot.x
    py[shape.piece] = spot.y
    mark(shape, spot.x, spot.y, shape.piece + 1)
    placedServed.push(shape)
  }

  // The roads for the state, and its cost: members with no road and buildings with no room
  // first, then the roads, then the same buildings side by side
  const evaluate = () => {
    const plan = new Plan(frame)
    for (const shape of placedServed) plan.put(shape, px[shape.piece], py[shape.piece])
    plan.route()
    let short = plan.unreachable * 50
    const free = plan.count(FREE)
    if (free < looseArea) short += looseArea - free
    for (const shape of bigLoose) if (!plan.placeFree(shape)) short += shape.area
    return short * 100000 + plan.roadCount() * 100 - plan.twinPairs()
  }

  let current = evaluate()
  let best = { cost: current, px: px.slice(), py: py.slice() }
  const budget = seconds * 1000 * (1 - GATHER_SHARE)
  const start = now()
  for (let step = 0; placedServed.length && now() - start < budget; step++) {
    const tryInRound = step % ROUND
    if (tryInRound === 0 && step > 0) {
      // Each round starts again from the best plan
      occupied.fill(0)
      px.set(best.px)
      py.set(best.py)
      for (const s of placedServed) mark(s, px[s.piece], py[s.piece], s.piece + 1)
      current = best.cost
    }
    const temperature = 100 * HOT * (COLD / HOT) ** (tryInRound / ROUND)
    const shape = placedServed[Math.floor(rand() * placedServed.length)]
    const i = shape.piece
    const was = { x: px[i], y: py[i] }
    let other: Shape | undefined
    if (rand() < 0.25) {
      // Two pieces of the same outline swap places
      const twins = placedServed.filter((s) => s !== shape && s.outline === shape.outline)
      if (!twins.length) continue
      other = twins[Math.floor(rand() * twins.length)]
      const j = other.piece
      ;[px[i], px[j]] = [px[j], px[i]]
      ;[py[i], py[j]] = [py[j], py[i]]
      mark(shape, px[i], py[i], i + 1)
      mark(other, px[j], py[j], j + 1)
    } else {
      // Moved near its place, or near the town hall
      let x: number
      let y: number
      if (rand() < 0.5) {
        x = was.x + Math.floor(rand() * 11) - 5
        y = was.y + Math.floor(rand() * 11) - 5
      } else {
        const cell = scan[Math.floor(rand() * Math.max(1, Math.floor(scan.length / 3)))]
        x = cell % width
        y = (cell - x) / width
      }
      if ((x === was.x && y === was.y) || !fitsAt(shape, x, y)) continue
      mark(shape, was.x, was.y, 0)
      mark(shape, x, y, i + 1)
      px[i] = x
      py[i] = y
    }
    const cost = evaluate()
    if (cost <= current || rand() < Math.exp((current - cost) / temperature)) {
      current = cost
      if (cost < best.cost) best = { cost, px: px.slice(), py: py.slice() }
    } else if (other) {
      const j = other.piece
      ;[px[i], px[j]] = [px[j], px[i]]
      ;[py[i], py[j]] = [py[j], py[i]]
      mark(shape, px[i], py[i], i + 1)
      mark(other, px[j], py[j], j + 1)
    } else {
      mark(shape, px[i], py[i], 0)
      mark(shape, was.x, was.y, i + 1)
      px[i] = was.x
      py[i] = was.y
    }
    onProgress?.((1 - GATHER_SHARE) * Math.min(1, (now() - start) / budget))
  }

  // The best plan: its roads, the roads no building needs removed
  px.set(best.px)
  py.set(best.py)
  const roadPlan = new Plan(frame)
  for (const shape of placedServed) roadPlan.put(shape, px[shape.piece], py[shape.piece])
  roadPlan.route()
  roadPlan.prune()

  // The buildings without a road around the biggest free block that leaves room for all
  // of them, from the biggest blocks down (at the corners of the free rectangles)
  const room = roadPlan.count(FREE) - looseArea
  const candidates: MapRect[] = []
  const tried = new Set<string>()
  for (const r of roadPlan.freeRects()) {
    for (let w = Math.min(r.w, room); w >= FREE_SIDE; w--) {
      for (let h = Math.min(r.h, Math.floor(room / w)); h >= FREE_SIDE; h--) {
        for (const [x, y] of [
          [r.x, r.y],
          [r.x + r.w - w, r.y],
          [r.x, r.y + r.h - h],
          [r.x + r.w - w, r.y + r.h - h],
        ]) {
          const key = `${x},${y},${w},${h}`
          if (tried.has(key)) continue
          tried.add(key)
          candidates.push({ x, y, w, h })
        }
      }
    }
  }
  candidates.sort((a, b) => b.w * b.h - a.w * a.h)
  const fill = (reserve?: MapRect) => {
    const plan = new Plan(frame)
    plan.cells.set(roadPlan.cells)
    plan.placed = [...roadPlan.placed]
    if (reserve) {
      for (let x = reserve.x; x < reserve.x + reserve.w; x++) {
        for (let y = reserve.y; y < reserve.y + reserve.h; y++) plan.cells[y * width + x] = RESERVED
      }
    }
    for (const shape of loose) if (!plan.placeFree(shape)) plan.unplaced.push(shape)
    for (let k = 0; k < plan.cells.length; k++) if (plan.cells[k] === RESERVED) plan.cells[k] = FREE
    return plan
  }
  let final: Plan | undefined
  const gatherStart = now()
  const gatherBudget = seconds * 1000 * GATHER_SHARE
  for (const reserve of candidates) {
    if (now() - gatherStart > gatherBudget) break
    const plan = fill(reserve)
    onProgress?.(1 - GATHER_SHARE * (1 - Math.min(1, (now() - gatherStart) / gatherBudget)))
    if (!plan.unplaced.length) {
      final = plan
      break
    }
  }
  final ??= fill()
  final.unplaced.push(...leftOut)
  onProgress?.(1)

  const back = (x: number, y: number) => ({ x: x + frame.x0, y: y + frame.y0 })
  const positions: RebuildResult["positions"] = {}
  for (const { shape, x, y } of final.placed) {
    for (const m of frame.pieces[shape.piece].members) {
      positions[m.entity] = back(x + m.dx, y + m.dy)
    }
  }
  const roads: RebuildResult["roads"] = []
  let freeTiles = 0
  final.cells.forEach((value, i) => {
    if (value === FREE) freeTiles++
    if (!isRoad(value)) return
    const x = i % width
    const y = (i - x) / width
    roads.push({ ...back(x, y), w: 1, h: 1, level: value === ROAD2 ? 2 : 1 })
  })
  const rect = final.freeRects()[0]
  return {
    positions,
    roads,
    unplaced: final.unplaced.flatMap((s) => frame.pieces[s.piece].members.map((m) => m.entity)),
    roadTiles: roads.length,
    freeTiles,
    ...(rect && { freeRect: { ...back(rect.x, rect.y), w: rect.w, h: rect.h } }),
  }
}

// The problem for a city: its unlocked land, its town hall, its buildings as pieces where
// they stand (a group of `groups` keeps its members where they stand to each other).
// Undefined when the city was imported before sizes and roads were kept, or has no town hall
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
      at: { x, y },
      members: entities.map(({ i, e }) => ({
        entity: i,
        dx: e.x - x,
        dy: e.y - y,
        w: e.w!,
        h: e.h!,
        road: e.road!,
        kind: e.id,
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
