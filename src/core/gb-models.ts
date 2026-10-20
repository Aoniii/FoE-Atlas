// Hand-made progressions for Great Building bonuses no simple formula reproduces
// (see gb-extrapolate.ts), fitted on the wiki levels and in-game readings.
// Keyed by Great Building id, then by the column's English label.
// `readings` are values seen in game: they win over the formula at their level.

export type ManualModel = {
  value: (level: number) => number
  readings?: Record<number, number>
}

const round2 = (value: number) => Math.round(value * 100) / 100

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
}

export function manualValue(model: ManualModel, level: number): number {
  return model.readings?.[level] ?? model.value(level)
}
