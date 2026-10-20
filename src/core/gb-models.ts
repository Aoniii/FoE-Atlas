// Hand-made progressions for Great Building bonuses no simple formula reproduces
// (see gb-extrapolate.ts), fitted on the wiki levels and in-game readings.
// Keyed by Great Building id, then by the column's English label.
// `readings` are values seen in game: they win over the formula at their level.

export type ManualModel = {
  value: (level: number) => number
  readings?: Record<number, number>
}

const round2 = (value: number) => Math.round(value * 100) / 100

// Galata Tower plunder repel chance: cubic fitted on wiki levels 50-80 and the readings
// (within 0.04 point), held at its peak (level ~227) so it never decreases
const galataPercent = (level: number) => {
  const l = Math.min(level, 227)
  return round2(21.5149 + 0.47809 * l - 0.001727 * l ** 2 + 0.00000198 * l ** 3)
}

export const MANUAL_GB_MODELS: Record<string, Record<string, ManualModel>> = {
  temple_of_relics: {
    // Chance to find a relic: fits wiki levels 60-80 and the readings exactly
    "Relic Hunt (%)": {
      value: (level) => Math.floor(35.45 - 23.5 * Math.exp(-level / 38) + 1e-9),
      readings: { 129: 34, 150: 34, 171: 35 },
    },
    // Share of rare relics: within 0.09 point of every known value (wiki and readings)
    "Relic Hunt (Rare Totem %)": {
      value: (level) => round2(36.45 - 33.225 * Math.exp(-level / 135.88)),
      readings: { 129: 23.68, 150: 25.46, 171: 26.93 },
    },
  },
  galata_tower: {
    // 6 since level 71 on the wiki, still 6 in game at level 175
    "Plunder Repel (#)": { value: () => 6 },
    // Reading at level 123 (58.13) left out: higher than level 124, likely a typo
    "Plunder Repel (%)": {
      value: galataPercent,
      readings: { 124: 57.99, 152: 61.26, 153: 61.35, 174: 62.87, 175: 62.93 },
    },
  },
}

export function manualValue(model: ManualModel, level: number): number {
  return model.readings?.[level] ?? model.value(level)
}
