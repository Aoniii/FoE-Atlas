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
  // Its family (all levels of a building) and its rank in it (level, then age): a family
  // stays together, in rank order
  kind?: string
  rank?: number
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
  // Free tiles cut off from the main free land
  isolatedTiles: number
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
export const REBUILD_SECONDS = 300

// Tries of an annealing round, and its temperature from start to end (in roads)
const ROUND = 4000
const HOT = 3
const COLD = 0.05
// Pieces without a road smaller than this fill the nooks (see fillNooks)
const NOOK_AREA = 9
// Share of the search time for the quick search (the rest: the full one), and the tries of
// a round of the full search
const QUICK_SHARE = 0.55
const FULL_ROUND = 600
// An island takes in another's plan at the start of a round only when it is better by this
// much (three tiles), and only so often
const MIGRATION_GAP = 300
const MIGRATION_ODDS = 0.25
// Street tries (a zone rebuilt in rows along a new street): their share, and the half-size
// of the zone
const STREET_SHARE = 0.12
const STREET = 7
// Ruin and recreate tries: their share, and the half-size of the zone emptied
const RUIN_SHARE = 0.08
const RUIN = 6
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
  // The family of the buildings it holds, and their rank in it
  kind: string
  rank: number
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
    rank: piece.members[0]?.rank ?? 0,
    outline: `${piece.members.map((m) => m.road).join("")}:${[...covered].sort().join(";")}`,
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

  // Around the piece: road tiles, and tiles taken by something else than a road
  private touching(shape: Shape, px: number, py: number) {
    let roads = 0
    let solid = 0
    for (const [dx, dy] of shape.around) {
      const v = this.at(px + dx, py + dy)
      if (isRoad(v)) roads++
      else if (v !== FREE) solid++
    }
    return { roads, solid }
  }

  // Best free spot for a piece without a road: beside its family, tight against other
  // buildings, away from the roads (their sides are for the buildings needing one), then
  // farthest from `anchor` (the free land gathers there; default: nearest the town hall)
  placeFree(shape: Shape, anchor?: { x: number; y: number }): boolean {
    const { width, height, hall } = this.frame
    let best = -Infinity
    let bx = 0
    let by = 0
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        if (!this.fits(shape, px, py)) continue
        const { roads, solid } = this.touching(shape, px, py)
        const score =
          this.twins(shape, px, py) * 3000 +
          solid * 1000 -
          roads * 300 +
          (anchor
            ? (Math.abs(px - anchor.x) + Math.abs(py - anchor.y)) * 40
            : -(Math.abs(px - hall.x) + Math.abs(py - hall.y)))
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

  // Rectangles of free tiles with both sides at least `side` (FREE_SIDE by default),
  // biggest first (every maximal rectangle comes out of the row histograms)
  freeRects(side = FREE_SIDE): MapRect[] {
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
          if (rw >= side && rh >= side) {
            found.set(`${left},${y - rh + 1},${rw},${rh}`, { x: left, y: y - rh + 1, w: rw, h: rh })
          }
        }
        stack.push(x)
      }
    }
    return [...found.values()].sort((a, b) => b.w * b.h - a.w * a.h)
  }

  // MaxRects: each piece, biggest first, at a corner of a maximal free rectangle, the one
  // leaving the least to spare (short side, then long side), then away from the roads and
  // beside its family. The pieces with no room are given back
  packRects(shapes: Shape[]): Shape[] {
    const left: Shape[] = []
    for (const shape of [...shapes].sort(byArea)) {
      const bw = Math.max(...shape.cells.map(([x]) => x)) + 1
      const bh = Math.max(...shape.cells.map(([, y]) => y)) + 1
      let best: { x: number; y: number; score: number } | undefined
      for (const r of this.freeRects(1)) {
        if (r.w < bw || r.h < bh) continue
        const spareShort = Math.min(r.w - bw, r.h - bh)
        const spareLong = Math.max(r.w - bw, r.h - bh)
        for (const [x, y] of [
          [r.x, r.y],
          [r.x + r.w - bw, r.y],
          [r.x, r.y + r.h - bh],
          [r.x + r.w - bw, r.y + r.h - bh],
        ]) {
          if (!this.fits(shape, x, y)) continue
          const { roads } = this.touching(shape, x, y)
          const score = spareShort * 100000 + spareLong * 100 + roads * 10 - this.twins(shape, x, y)
          if (!best || score < best.score) best = { x, y, score }
        }
      }
      if (best) this.put(shape, best.x, best.y)
      else left.push(shape)
    }
    return left
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

  // Free land in connected parts: the label of each free tile, the size of each part, the
  // biggest part
  freeParts() {
    const { width, height } = this.frame
    const label = new Int32Array(width * height).fill(-1)
    const sizes: number[] = []
    for (let start = 0; start < label.length; start++) {
      if (this.cells[start] !== FREE || label[start] >= 0) continue
      const id = sizes.length
      const queue = [start]
      label[start] = id
      for (let k = 0; k < queue.length; k++) {
        const x = queue[k] % width
        const y = (queue[k] - x) / width
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const n = ny * width + nx
          if (label[n] >= 0 || this.cells[n] !== FREE) continue
          label[n] = id
          queue.push(n)
        }
      }
      sizes.push(queue.length)
    }
    const main = sizes.reduce((best, size, id) => (size > (sizes[best] ?? -1) ? id : best), 0)
    return { label, sizes, main }
  }

  // Free tiles outside the biggest free part
  isolated() {
    const { sizes, main } = this.freeParts()
    return sizes.reduce((sum, size, id) => (id === main ? sum : sum + size), 0)
  }

  // Places the small pieces without a road from the free tile farthest from the anchor, the
  // most shut in first among the same distance (a nook, a slot along a road), the snuggest
  // fitting piece each time: the free land left gathers around the anchor
  fillNooks(shapes: Shape[], anchor: { x: number; y: number }) {
    const { width, height } = this.frame
    const left = [...shapes]
    const skipped = new Uint8Array(width * height)
    while (left.length) {
      let nook = -1
      let farthest = -Infinity
      for (let i = 0; i < this.cells.length; i++) {
        if (this.cells[i] !== FREE || skipped[i]) continue
        const x = i % width
        const y = (i - x) / width
        let open = 0
        for (const [dx, dy] of NEIGHBOURS) if (this.at(x + dx, y + dy) === FREE) open++
        const score = (Math.abs(x - anchor.x) + Math.abs(y - anchor.y)) * 10 - open
        if (score > farthest) {
          nook = i
          farthest = score
        }
      }
      if (nook < 0) break
      const nx = nook % width
      const ny = (nook - nx) / width
      let best: { k: number; x: number; y: number; score: number } | undefined
      const outlines = new Set<string>()
      left.forEach((shape, k) => {
        if (outlines.has(shape.outline + shape.kind)) return
        outlines.add(shape.outline + shape.kind)
        for (const [dx, dy] of shape.cells) {
          const x = nx - dx
          const y = ny - dy
          if (!this.fits(shape, x, y)) continue
          const { roads, solid } = this.touching(shape, x, y)
          const score = (solid + roads) * 100 + this.twins(shape, x, y) * 30 + shape.area
          if (!best || score > best.score) best = { k, x, y, score }
        }
      })
      if (!best) {
        skipped[nook] = 1
        continue
      }
      this.put(left[best.k], best.x, best.y)
      left.splice(best.k, 1)
    }
    return left
  }

  // Fills the holes cut off from the main free land: a building without a road on the edge
  // of the main free land moves into a hole, the tiles it leaves join the main free land
  fillHoles() {
    const { width } = this.frame
    for (let pass = 0; pass < 200; pass++) {
      const { label, sizes, main } = this.freeParts()
      const before = sizes.reduce((sum, size, id) => (id === main ? sum : sum + size), 0)
      if (!before) return
      const holes = sizes.map((size, id) => ({ size, id })).filter((h) => h.id !== main)
      holes.sort((a, b) => a.size - b.size)
      // Buildings without a road, those touching the main free land first (the tiles they
      // leave join it)
      const touchesMain = (p: Plan["placed"][number]) =>
        p.shape.around.some(
          ([dx, dy]) =>
            this.at(p.x + dx, p.y + dy) === FREE && label[(p.y + dy) * width + p.x + dx] === main,
        )
      const movable = this.placed
        .filter((p) => p.shape.level === 0)
        .sort(
          (a, b) => Number(touchesMain(b)) - Number(touchesMain(a)) || a.shape.area - b.shape.area,
        )
      let improved = false
      for (const hole of holes) {
        const cells: number[] = []
        for (let i = 0; i < label.length; i++) if (label[i] === hole.id) cells.push(i)
        for (const p of movable.filter((m) => m.shape.area <= hole.size)) {
          for (const c of cells) {
            const cx = c % width
            const cy = (c - cx) / width
            for (const [dx, dy] of p.shape.cells) {
              const nx = cx - dx
              const ny = cy - dy
              const inHole = p.shape.cells.every(
                ([ex, ey]) =>
                  this.at(nx + ex, ny + ey) === FREE &&
                  label[(ny + ey) * width + nx + ex] === hole.id,
              )
              if (!inHole) continue
              const was = { x: p.x, y: p.y }
              this.move(p, nx, ny)
              if (this.isolated() < before) {
                improved = true
                break
              }
              this.move(p, was.x, was.y)
            }
            if (improved) break
          }
          if (improved) break
        }
        if (improved) break
      }
      if (!improved) return
    }
  }

  // Moves a placed piece
  private move(p: Plan["placed"][number], x: number, y: number) {
    const { width } = this.frame
    for (const [dx, dy] of p.shape.cells) this.cells[(p.y + dy) * width + p.x + dx] = FREE
    p.x = x
    p.y = y
    for (const [dx, dy] of p.shape.cells) this.cells[(y + dy) * width + x + dx] = p.shape.piece + 1
  }

  // Pieces of the same outline (often the levels of one building) share out their places:
  // the same tiles, the same roads, only who stands where changes. The places are walked
  // from one to its nearest, and the pieces take them family by family, each family in rank
  // order (level, then age): families together, in order
  arrangeFamilies() {
    const { width } = this.frame
    const groups = new Map<string, Plan["placed"]>()
    for (const p of this.placed)
      groups.set(p.shape.outline, [...(groups.get(p.shape.outline) ?? []), p])
    for (const group of groups.values()) {
      if (group.length < 2) continue
      const left = group.map(({ x, y }) => ({ x, y }))
      left.sort((a, b) => a.y - b.y || a.x - b.x)
      const walk = [left.shift()!]
      while (left.length) {
        const last = walk[walk.length - 1]
        let nearest = 0
        for (let k = 1; k < left.length; k++) {
          const d = Math.abs(left[k].x - last.x) + Math.abs(left[k].y - last.y)
          const best = Math.abs(left[nearest].x - last.x) + Math.abs(left[nearest].y - last.y)
          if (d < best) nearest = k
        }
        walk.push(left.splice(nearest, 1)[0])
      }
      const shapes = group
        .map((p) => p.shape)
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.rank - b.rank)
      group.forEach((p, k) => {
        p.shape = shapes[k]
        p.x = walk[k].x
        p.y = walk[k].y
        for (const [dx, dy] of p.shape.cells) {
          this.cells[(p.y + dy) * width + p.x + dx] = p.shape.piece + 1
        }
      })
    }
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

// A plan as the searches share it: which phase, its cost, where the pieces needing a road
// stand
export type RebuildShare = { phase: number; cost: number; px: Int32Array; py: Int32Array }

// One search (an island when several run side by side, see the worker): it runs by slices
// of time, shares its best plan, takes in a better one from the others at the start of its
// next round, then finishes into a result
export type RebuildSearch = {
  // Runs for `ms` milliseconds at most; true once the search time is over
  run: (ms: number) => boolean
  best: () => RebuildShare
  adopt: (plan: RebuildShare) => void
  finish: () => RebuildResult
}

export function rebuildCity(input: RebuildInput, options: RebuildOptions = {}): RebuildResult {
  const search = createSearch(input, options)
  while (!search.run(Infinity));
  return search.finish()
}

export function createSearch(
  input: RebuildInput,
  options: RebuildOptions & { island?: number; islands?: number } = {},
): RebuildSearch {
  const { seconds = REBUILD_SECONDS, seed = 1, onProgress, island = 0, islands = 1 } = options
  const rand = random(seed + island * 7919)
  // Islands differ: hotter or colder searches, other starting plans
  const heat = islands > 1 ? 0.6 + (0.8 * island) / (islands - 1) : 1
  const frame = frameOf(input)
  const { width, height, hall, shapes } = frame
  const served = shapes.filter((s) => s.level > 0)
  const loose = shapes.filter((s) => s.level === 0).sort(byArea)

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

  // The buildings without a road: the big ones away from the anchor (where the free land
  // gathers), the small ones in the nooks from the farthest
  const packLoose = (plan: Plan, anchor: { x: number; y: number }) => {
    for (const shape of loose.filter((s) => s.area >= NOOK_AREA)) {
      if (!plan.placeFree(shape, anchor)) plan.unplaced.push(shape)
    }
    const small = loose.filter((s) => s.area < NOOK_AREA)
    for (const shape of plan.fillNooks(small, anchor)) {
      if (!plan.placeFree(shape, anchor)) plan.unplaced.push(shape)
    }
  }
  // The free land gathers at the middle of the biggest free rectangle of the city as it is
  const home = (() => {
    const plan = new Plan(frame)
    for (const shape of placedServed) plan.put(shape, px[shape.piece], py[shape.piece])
    plan.route()
    const r = plan.freeRects()[0]
    return r
      ? { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }
      : { x: hall.x, y: hall.y }
  })()

  const looseArea = loose.reduce((sum, s) => sum + s.area, 0)
  const singles = loose.filter((s) => s.area === 1).length
  const bigLoose = loose.filter((s) => s.area >= 16)

  // A try: its roads, the big buildings without a road, and what the small ones will leave:
  // a free tile with no free tile above or below only takes a one-tile building, past those
  // the city has it stays a hole. Its cost: members with no road and buildings with no room
  // first, then the size of the main free block (all the land but the buildings, the roads
  // and the holes: roads and holes weigh the same, a road filling a hole gains nothing),
  // then the fewest roads. Families are gathered at the end (see arrangeFamilies)
  const evaluate = (full: boolean) => {
    const plan = new Plan(frame)
    for (const shape of placedServed) plan.put(shape, px[shape.piece], py[shape.piece])
    plan.route()
    if (full) {
      // Every building without a road placed, the free tiles cut off counted for real
      packLoose(plan, home)
      const left = plan.unplaced.reduce((sum, s) => sum + s.area, 0)
      const roads = plan.roadCount()
      return (plan.unreachable * 50 + left) * 100000 + (roads + plan.isolated()) * 100 + roads
    }
    let short = plan.unreachable * 50
    if (plan.count(FREE) < looseArea) short += looseArea - plan.count(FREE)
    for (const shape of bigLoose) if (!plan.placeFree(shape, home)) short += shape.area
    let lonely = 0
    for (let i = 0; i < plan.cells.length; i++) {
      if (plan.cells[i] !== FREE) continue
      const up = i >= width ? plan.cells[i - width] : OUT
      const down = i + width < plan.cells.length ? plan.cells[i + width] : OUT
      if (up !== FREE && down !== FREE) lonely++
    }
    const holes = Math.max(0, lonely - singles)
    const roads = plan.roadCount()
    return short * 100000 + (roads + holes) * 100 + roads
  }

  // Rows along streets, the way players lay out a city: streets every 2 x depth + 1 tiles,
  // the pieces needing a road side by side along each (two-lane ones first, by the town
  // hall), family after family in rank order, the streets nearest the town hall first
  const familyArea = new Map<string, number>()
  for (const s of placedServed) familyArea.set(s.kind, (familyArea.get(s.kind) ?? 0) + s.area)
  const rowOrder = [...placedServed].sort(
    (a, b) =>
      b.level - a.level ||
      familyArea.get(b.kind)! - familyArea.get(a.kind)! ||
      a.kind.localeCompare(b.kind) ||
      a.rank - b.rank,
  )
  const bounds = new Map(
    placedServed.map((s) => [
      s.piece,
      {
        w: Math.max(...s.cells.map(([x]) => x)) + 1,
        h: Math.max(...s.cells.map(([, y]) => y)) + 1,
      },
    ]),
  )
  const firstRoom = (shape: Shape) => {
    for (const i of scan) {
      const x = i % width
      const y = (i - x) / width
      if (fitsAt(shape, x, y)) return { x, y }
    }
    return undefined
  }
  const lineUp = (horizontal: boolean, depth: number, offset: number, side: 0 | 1) => {
    occupied.fill(0)
    // The trunk joining the streets to the town hall, kept clear while the rows are laid
    const trunk = horizontal
      ? side
        ? hall.x + hall.w
        : hall.x - 1
      : side
        ? hall.y + hall.h
        : hall.y - 1
    const trunkTiles: number[] = []
    for (let k = 0; k < (horizontal ? height : width); k++) {
      const x = horizontal ? trunk : k
      const y = horizontal ? k : trunk
      if (x < 0 || y < 0 || x >= width || y >= height) continue
      const i = y * width + x
      if (frame.base[i] === FREE) trunkTiles.push(i)
    }
    for (const i of trunkTiles) occupied[i] = -1
    const span = horizontal ? height : width
    const length = horizontal ? width : height
    const middle = horizontal ? hall.y + hall.h / 2 : hall.x + hall.w / 2
    const lines: number[] = []
    for (let c = offset; c < span; c += 2 * depth + 1) lines.push(c)
    lines.sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))
    const strips = lines.flatMap((c) => [
      { c, side: -1, cursor: 0 },
      { c, side: 1, cursor: 0 },
    ])
    const later: Shape[] = []
    for (const shape of rowOrder) {
      const { w, h } = bounds.get(shape.piece)!
      const front = horizontal ? w : h
      const deep = horizontal ? h : w
      let done = false
      if (shape.level === 2) {
        const spot = firstRoom(shape)
        if (spot) {
          px[shape.piece] = spot.x
          py[shape.piece] = spot.y
          mark(shape, spot.x, spot.y, shape.piece + 1)
          done = true
        }
      } else if (deep <= depth) {
        for (const strip of strips) {
          for (; strip.cursor + front <= length; strip.cursor++) {
            const across = strip.side < 0 ? strip.c - deep : strip.c + 1
            const x = horizontal ? strip.cursor : across
            const y = horizontal ? across : strip.cursor
            if (!fitsAt(shape, x, y)) continue
            px[shape.piece] = x
            py[shape.piece] = y
            mark(shape, x, y, shape.piece + 1)
            strip.cursor += front
            done = true
            break
          }
          if (done) break
        }
      }
      if (!done) later.push(shape)
    }
    for (const i of trunkTiles) occupied[i] = 0
    for (const shape of later) {
      const spot = firstRoom(shape)
      if (!spot) return false
      px[shape.piece] = spot.x
      py[shape.piece] = spot.y
      mark(shape, spot.x, spot.y, shape.piece + 1)
    }
    return true
  }

  // Starting plans: the city as it is and the rows along streets, best first; each island
  // starts from its own one
  const starts = [{ cost: evaluate(false), px: px.slice(), py: py.slice() }]
  for (const horizontal of [true, false]) {
    for (let depth = 3; depth <= 7; depth++) {
      for (let offset = 0; offset < 2 * depth + 1; offset++) {
        for (const side of [0, 1] as const) {
          if (!lineUp(horizontal, depth, offset, side)) continue
          starts.push({ cost: evaluate(false), px: px.slice(), py: py.slice() })
        }
      }
    }
  }
  starts.sort((a, b) => a.cost - b.cost)
  // Only starts where every building finds its road and its room
  const sound = starts.filter((p) => p.cost < 100000)
  let best = sound.length ? sound[island % sound.length] : starts[0]
  const load = (plan: { px: Int32Array; py: Int32Array }) => {
    occupied.fill(0)
    px.set(plan.px)
    py.set(plan.py)
    for (const s of placedServed) mark(s, px[s.piece], py[s.piece], s.piece + 1)
  }
  load(best)
  let current = best.cost

  // First the quick search (the roads), then the full one (the free land together) from
  // the best plan found
  let full = false
  let roundStart = 0
  let step = 0
  let incoming: RebuildShare | undefined
  const budget = seconds * 1000 * (1 - GATHER_SHARE)
  const start = now()
  const tryOnce = () => {
    if (!full && now() - start > budget * QUICK_SHARE) {
      full = true
      roundStart = step
      load(best)
      current = evaluate(full)
      best = { cost: current, px: px.slice(), py: py.slice() }
    }
    const round = full ? FULL_ROUND : ROUND
    const tryInRound = (step - roundStart) % round
    step++
    if (tryInRound === 0 && step > roundStart + 1) {
      // Each round starts again from the best plan, the others' one when it is better
      // (rarely, and only far better: the islands keep searching their own ways)
      if (
        incoming &&
        incoming.phase === Number(full) &&
        incoming.cost < best.cost - MIGRATION_GAP &&
        rand() < MIGRATION_ODDS
      ) {
        best = { cost: incoming.cost, px: incoming.px.slice(), py: incoming.py.slice() }
      }
      incoming = undefined
      load(best)
      current = best.cost
    }
    const temperature = 100 * HOT * heat * (COLD / HOT) ** (tryInRound / round)
    const shape = placedServed[Math.floor(rand() * placedServed.length)]
    const i = shape.piece
    const was = { x: px[i], y: py[i] }
    // Pieces this try moves, with where they stood: put back if the try is refused
    const moved: { shape: Shape; x: number; y: number }[] = []
    const lift = (s: Shape) => {
      moved.push({ shape: s, x: px[s.piece], y: py[s.piece] })
      mark(s, px[s.piece], py[s.piece], 0)
    }
    const drop = (s: Shape, x: number, y: number) => {
      px[s.piece] = x
      py[s.piece] = y
      mark(s, x, y, s.piece + 1)
    }
    const undo = () => {
      for (const m of moved) mark(m.shape, px[m.shape.piece], py[m.shape.piece], 0)
      for (const m of moved) drop(m.shape, m.x, m.y)
    }
    const move = rand()
    if (move < STREET_SHARE) {
      // A street laid across the zone around this piece, the zone's pieces put back in rows
      // on both sides of it (family after family, in rank order), as a player lines a street
      const horizontal = rand() < 0.5
      const line = (horizontal ? was.y : was.x) + Math.floor(rand() * 5) - 2
      const zone = placedServed
        .filter(
          (s) =>
            s.level === 1 &&
            Math.abs(px[s.piece] - was.x) <= STREET &&
            Math.abs(py[s.piece] - was.y) <= STREET,
        )
        .slice(0, 12)
      for (const s of zone) lift(s)
      const from = (horizontal ? was.x : was.y) - STREET
      const to = (horizontal ? was.x : was.y) + STREET
      // The street kept clear while the rows are laid
      const street: number[] = []
      for (let k = from; k <= to; k++) {
        const x = horizontal ? k : line
        const y = horizontal ? line : k
        if (x < 0 || y < 0 || x >= width || y >= height) continue
        const t = y * width + x
        if (frame.base[t] === FREE && !occupied[t]) street.push(t)
      }
      for (const t of street) occupied[t] = -1
      const cursors = [from, from]
      const back: Shape[] = []
      let ok = true
      for (const s of [...zone].sort((a, b) => rowOrder.indexOf(a) - rowOrder.indexOf(b))) {
        const { w, h } = bounds.get(s.piece)!
        const front = horizontal ? w : h
        const deep = horizontal ? h : w
        let done = false
        // The shorter row first
        for (const side of cursors[0] <= cursors[1] ? [0, 1] : [1, 0]) {
          for (let k = cursors[side]; k + front <= to + 1 && !done; k++) {
            const across = side === 0 ? line - deep : line + 1
            const x = horizontal ? k : across
            const y = horizontal ? across : k
            if (!fitsAt(s, x, y)) continue
            drop(s, x, y)
            cursors[side] = k + front
            done = true
          }
          if (done) break
        }
        if (!done) {
          // No room in the rows: the tightest spot of the zone
          let bestScore = -Infinity
          let bx = 0
          let by = 0
          for (let y = was.y - STREET; y <= was.y + STREET; y++) {
            for (let x = was.x - STREET; x <= was.x + STREET; x++) {
              if (!fitsAt(s, x, y)) continue
              const score = rand()
              if (score > bestScore) {
                bestScore = score
                bx = x
                by = y
              }
            }
          }
          if (bestScore === -Infinity) {
            ok = false
            break
          }
          drop(s, bx, by)
        }
        back.push(s)
      }
      for (const t of street) occupied[t] = 0
      if (!ok) {
        for (const s of back) mark(s, px[s.piece], py[s.piece], 0)
        for (const m of moved) drop(m.shape, m.x, m.y)
        return
      }
    } else if (move < STREET_SHARE + RUIN_SHARE) {
      // Ruin and recreate: the pieces around this one taken out, then put back biggest first
      // where each sits the tightest (rows form)
      const zone = placedServed
        .filter(
          (s) => Math.abs(px[s.piece] - was.x) <= RUIN && Math.abs(py[s.piece] - was.y) <= RUIN,
        )
        .slice(0, 10)
      for (const s of zone) lift(s)
      const back: Shape[] = []
      let ok = true
      for (const s of [...zone].sort(byArea)) {
        let bestScore = -Infinity
        let bx = 0
        let by = 0
        for (let y = was.y - RUIN; y <= was.y + RUIN; y++) {
          for (let x = was.x - RUIN; x <= was.x + RUIN; x++) {
            if (!fitsAt(s, x, y)) continue
            let tight = 0
            for (const [dx, dy] of s.around) {
              const ax = x + dx
              const ay = y + dy
              const k = ay * width + ax
              if (
                ax < 0 ||
                ay < 0 ||
                ax >= width ||
                ay >= height ||
                frame.base[k] !== FREE ||
                occupied[k]
              ) {
                tight++
              }
            }
            const score = tight * 1000 + rand() * 600
            if (score > bestScore) {
              bestScore = score
              bx = x
              by = y
            }
          }
        }
        if (bestScore === -Infinity) {
          ok = false
          break
        }
        drop(s, bx, by)
        back.push(s)
      }
      if (!ok) {
        for (const s of back) mark(s, px[s.piece], py[s.piece], 0)
        for (const m of moved) drop(m.shape, m.x, m.y)
        return
      }
    } else if (move < STREET_SHARE + RUIN_SHARE + 0.25) {
      // Two pieces of the same outline swap places
      const twins = placedServed.filter((s) => s !== shape && s.outline === shape.outline)
      if (!twins.length) return
      const other = twins[Math.floor(rand() * twins.length)]
      const to = { x: px[other.piece], y: py[other.piece] }
      lift(shape)
      lift(other)
      drop(shape, to.x, to.y)
      drop(other, was.x, was.y)
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
      if ((x === was.x && y === was.y) || !fitsAt(shape, x, y)) return
      lift(shape)
      drop(shape, x, y)
    }
    const cost = evaluate(full)
    if (cost <= current || rand() < Math.exp((current - cost) / temperature)) {
      current = cost
      if (cost < best.cost) best = { cost, px: px.slice(), py: py.slice() }
    } else {
      undo()
    }
  }

  const run = (ms: number) => {
    const until = now() + ms
    while (placedServed.length && now() - start < budget && now() < until) tryOnce()
    onProgress?.((1 - GATHER_SHARE) * Math.min(1, (now() - start) / budget))
    return !placedServed.length || now() - start >= budget
  }

  const finish = (): RebuildResult => {
    // The best plan: its roads, the roads no building needs removed
    px.set(best.px)
    py.set(best.py)
    const roadPlan = new Plan(frame)
    for (const shape of placedServed) roadPlan.put(shape, px[shape.piece], py[shape.piece])
    roadPlan.route()
    // A building no road reaches is left out, never shown without its road
    roadPlan.refresh()
    for (const p of [...roadPlan.placed]) {
      if (roadPlan.served(p.shape, p.x, p.y)) continue
      for (const [dx, dy] of p.shape.cells) roadPlan.cells[(p.y + dy) * width + p.x + dx] = FREE
      roadPlan.placed.splice(roadPlan.placed.indexOf(p), 1)
      leftOut.push(p.shape)
    }
    roadPlan.prune()

    // The buildings without a road, packed from the far side towards an anchor where the
    // free land gathers, the holes left filled; anchors at the free rectangles' corners and
    // middles, the plan with the fewest free tiles cut off from the main free land wins
    const anchors: { x: number; y: number }[] = []
    const seenAnchor = new Set<string>()
    for (const r of roadPlan.freeRects().slice(0, 12)) {
      for (const a of [
        { x: r.x, y: r.y },
        { x: r.x + r.w - 1, y: r.y },
        { x: r.x, y: r.y + r.h - 1 },
        { x: r.x + r.w - 1, y: r.y + r.h - 1 },
        { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) },
      ]) {
        if (seenAnchor.has(`${a.x},${a.y}`)) continue
        seenAnchor.add(`${a.x},${a.y}`)
        anchors.push(a)
      }
    }
    const fill = (anchor: { x: number; y: number }) => {
      const plan = new Plan(frame)
      plan.cells.set(roadPlan.cells)
      plan.placed = [...roadPlan.placed]
      packLoose(plan, anchor)
      if (!plan.unplaced.length) plan.fillHoles()
      return plan
    }
    // The same as a puzzle: the free land to keep set aside first (the tiles nearest the
    // anchor, as many as the city has to spare), the rest paved, the big pieces snug first,
    // then the small ones from the most shut-in tiles; pieces left over go on the edge of the
    // land set aside
    const pave = (anchor: { x: number; y: number }) => {
      const plan = new Plan(frame)
      plan.cells.set(roadPlan.cells)
      plan.placed = [...roadPlan.placed]
      const spare = plan.count(FREE) - loose.reduce((sum, s) => sum + s.area, 0)
      const start = anchor.y * width + anchor.x
      const kept: number[] = []
      if (spare > 0 && plan.cells[start] === FREE) {
        const seenTile = new Uint8Array(plan.cells.length)
        seenTile[start] = 1
        const queue = [start]
        for (let k = 0; k < queue.length && kept.length < spare; k++) {
          const i = queue[k]
          kept.push(i)
          const x = i % width
          const y = (i - x) / width
          for (const [dx, dy] of NEIGHBOURS) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const n = ny * width + nx
            if (seenTile[n] || plan.cells[n] !== FREE) continue
            seenTile[n] = 1
            queue.push(n)
          }
        }
      }
      for (const i of kept) plan.cells[i] = RESERVED
      const left: Shape[] = []
      for (const shape of loose.filter((s) => s.area >= NOOK_AREA)) {
        if (!plan.placeFree(shape)) left.push(shape)
      }
      left.push(
        ...plan.fillNooks(
          loose.filter((s) => s.area < NOOK_AREA),
          anchor,
        ),
      )
      for (const i of kept) plan.cells[i] = FREE
      for (const shape of left) if (!plan.placeFree(shape, anchor)) plan.unplaced.push(shape)
      if (!plan.unplaced.length) plan.fillHoles()
      return plan
    }
    // Judged on the buildings left out, the free tiles cut off, then the size of the free
    // block
    const judge = (plan: Plan) => {
      const rect = plan.freeRects()[0]
      return plan.unplaced.length * 1000000 + plan.isolated() * 1000 - (rect ? rect.w * rect.h : 0)
    }
    let final = fill(home)
    let finalScore = judge(final)
    const gatherStart = now()
    const gatherBudget = seconds * 1000 * GATHER_SHARE
    // MaxRects around a free block set aside (sizes the city can spare, at the corners of the
    // free rectangles), or with none
    const packed = (reserve?: MapRect) => {
      const plan = new Plan(frame)
      plan.cells.set(roadPlan.cells)
      plan.placed = [...roadPlan.placed]
      if (reserve) {
        for (let x = reserve.x; x < reserve.x + reserve.w; x++) {
          for (let y = reserve.y; y < reserve.y + reserve.h; y++)
            plan.cells[y * width + x] = RESERVED
        }
      }
      const left = plan.packRects(loose)
      for (let i = 0; i < plan.cells.length; i++)
        if (plan.cells[i] === RESERVED) plan.cells[i] = FREE
      for (const shape of left) if (!plan.placeFree(shape)) plan.unplaced.push(shape)
      if (!plan.unplaced.length) plan.fillHoles()
      return plan
    }
    const spare = roadPlan.count(FREE) - loose.reduce((sum, s) => sum + s.area, 0)
    const reserves: (MapRect | undefined)[] = [undefined]
    const seenReserve = new Set<string>()
    for (const r of roadPlan.freeRects().slice(0, 8)) {
      for (let w = Math.min(r.w, spare); w >= FREE_SIDE; w--) {
        const h = Math.min(r.h, Math.floor(spare / w))
        if (h < FREE_SIDE) continue
        for (const [x, y] of [
          [r.x, r.y],
          [r.x + r.w - w, r.y + r.h - h],
        ]) {
          if (seenReserve.has(`${x},${y},${w},${h}`)) continue
          seenReserve.add(`${x},${y},${w},${h}`)
          reserves.push({ x, y, w, h })
        }
      }
    }
    for (const reserve of reserves) {
      if (now() - gatherStart > gatherBudget / 2) break
      const plan = packed(reserve)
      const score = judge(plan)
      if (score < finalScore) {
        final = plan
        finalScore = score
      }
    }
    for (const anchor of anchors) {
      for (const plan of [pave(anchor), fill(anchor)]) {
        const score = judge(plan)
        if (score < finalScore) {
          final = plan
          finalScore = score
        }
      }
      if (now() - gatherStart > gatherBudget) break
      onProgress?.(1 - GATHER_SHARE * (1 - Math.min(1, (now() - gatherStart) / gatherBudget)))
    }
    final.arrangeFamilies()
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
      isolatedTiles: final.isolated(),
      ...(rect && { freeRect: { ...back(rect.x, rect.y), w: rect.w, h: rect.h } }),
    }
  }

  return {
    run,
    best: () => ({ phase: Number(full), cost: best.cost, px: best.px, py: best.py }),
    adopt: (plan) => {
      if (!incoming || plan.cost < incoming.cost) incoming = plan
    },
    finish,
  }
}

// The problem for a city: its unlocked land, its town hall, its buildings as pieces where
// they stand (a group of `groups` keeps its members where they stand to each other), each
// with its family and rank (`traits`, see rateCity).
// Undefined when the city was imported before sizes and roads were kept, or has no town hall
export function rebuildInput(
  city: City,
  groups: number[][],
  traits: ({ family: string; rank: number } | undefined)[] = [],
): RebuildInput | undefined {
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
        kind: traits[i]?.family ?? e.id,
        rank: traits[i]?.rank ?? 0,
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
