// Great Building bonuses beyond the levels listed on the wiki (80). Each column is
// matched against simple progressions; a model is kept only when it reproduces every
// known level from 11 to 80 exactly, then used to compute the next levels.

export type ColumnModel =
  // Same step every level from `from` on
  | { kind: "linear"; step: number }
  // Steps repeating with a period ("+1, +0, +0, +1, ...")
  | { kind: "periodic"; steps: number[]; origin: number }
  // v10 x (level / 10)^k, rounded like the game
  | { kind: "power"; k: number; rounding: "ceil" | "floor" | "round"; decimals: number }

const EPSILON = 1e-9

function roundTo(value: number, rounding: "ceil" | "floor" | "round", decimals: number) {
  const factor = 10 ** decimals
  const scaled = value * factor
  const result =
    rounding === "ceil"
      ? Math.ceil(scaled - EPSILON)
      : rounding === "floor"
        ? Math.floor(scaled + EPSILON)
        : Math.round(scaled)
  return result / factor
}

// `values[level]`, levels 1 to 80 at least
export function fitColumn(values: number[], decimals: number): ColumnModel | undefined {
  const last = values.length - 1
  if (last < 40) return undefined
  const step = (level: number) => Number((values[level + 1] - values[level]).toFixed(6))

  // Linear over (at least) the last 30 levels
  const lastStep = step(last - 1)
  if (Array.from({ length: 30 }, (_, i) => step(last - 1 - i)).every((s) => s === lastStep)) {
    return { kind: "linear", step: lastStep }
  }

  // Periodic steps from level 20 on
  const steps = Array.from({ length: last - 20 }, (_, i) => step(20 + i))
  for (let period = 2; period <= 10; period++) {
    if (steps.every((s, i) => i + period >= steps.length || s === steps[i + period])) {
      return { kind: "periodic", steps: steps.slice(0, period), origin: 20 }
    }
  }

  // Power law around v80 / v10
  const v10 = values[10]
  if (v10 > 0 && values[last] > 0) {
    const k0 = Math.log(values[last] / v10) / Math.log(last / 10)
    const candidates = Array.from({ length: 61 }, (_, i) =>
      Number((k0 + (i - 30) * 0.001).toFixed(3)),
    )
    candidates.sort((a, b) => Math.abs(a - k0) - Math.abs(b - k0))
    for (const k of candidates) {
      for (const rounding of ["ceil", "floor", "round"] as const) {
        const model = { kind: "power", k, rounding, decimals } as const
        let ok = true
        for (let level = 11; level <= last && ok; level++) {
          ok = Math.abs(valueAt(model, values, level) - values[level]) < EPSILON
        }
        if (ok) return model
      }
    }
  }
  return undefined
}

export function valueAt(model: ColumnModel, values: number[], level: number): number {
  const last = values.length - 1
  if (level <= last && model.kind !== "power") return values[level]
  switch (model.kind) {
    case "linear":
      return Number((values[last] + model.step * (level - last)).toFixed(6))
    case "periodic": {
      let value = values[last]
      for (let l = last; l < level; l++) {
        value += model.steps[(l - model.origin) % model.steps.length]
      }
      return Number(value.toFixed(6))
    }
    case "power":
      return roundTo(values[10] * Math.pow(level / 10, model.k), model.rounding, model.decimals)
  }
}

// Approximate progression for the columns no exact model reproduces: a curve that
// flattens out (a + b·e^(-level/c), percentages only) or keeps growing ever slower
// (a + b·level^k, k ≤ 1),
// whichever is closest to the known levels from 50 on (wiki and in-game readings). It starts from
// the last known value, never goes down, and a chance never goes past 100%.
export type ApproxModel = {
  form: "exp" | "power"
  a: number
  b: number
  shape: number
  last: [level: number, value: number]
  decimals: number
  cap?: number
  // Largest gap with the known levels it was fitted on
  error: number
}

const curve = (form: ApproxModel["form"], shape: number) =>
  form === "exp" ? (level: number) => Math.exp(-level / shape) : (level: number) => level ** shape

// `points`: known [level, value] pairs, in level order
export function fitApproximate(
  points: [number, number][],
  decimals: number,
  percent: boolean,
): ApproxModel | undefined {
  const used = points.filter(([level]) => level >= 50)
  if (used.length < 10) return undefined
  const last = used[used.length - 1]
  const shapes: [ApproxModel["form"], number][] = [
    ...Array.from({ length: 200 }, (_, i) => ["exp", 10 + i * 5] as [ApproxModel["form"], number]),
    ...Array.from(
      { length: 100 },
      (_, i) => ["power", 0.01 + i * 0.01] as [ApproxModel["form"], number],
    ),
  ]
  let best: ApproxModel | undefined
  for (const [form, shape] of shapes) {
    // Only percentages flatten out (chances, boosts): counts and amounts keep growing
    if (form === "exp" && !percent) continue
    // Least squares on a and b for this shape
    const g = curve(form, shape)
    const xs = used.map(([level]) => g(level))
    const ys = used.map(([, value]) => value)
    const mx = xs.reduce((s, x) => s + x, 0) / xs.length
    const my = ys.reduce((s, y) => s + y, 0) / ys.length
    const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
    if (sxx < 1e-12) continue
    const b = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / sxx
    const a = my - b * mx
    const error = Math.max(...xs.map((x, i) => Math.abs(a + b * x - ys[i])))
    if (!best || error < best.error) best = { form, a, b, shape, last, decimals, error }
  }
  if (best && percent && last[1] <= 100) best.cap = 100
  return best
}

export function approxValueAt(model: ApproxModel, level: number): number {
  const [lastLevel, lastValue] = model.last
  if (level <= lastLevel) return lastValue
  const g = curve(model.form, model.shape)
  const raw = lastValue + model.b * (g(level) - g(lastLevel))
  const value = Math.max(lastValue, Math.min(raw, model.cap ?? Infinity))
  return roundTo(value, "floor", model.decimals)
}
