// Hand-made progressions for Great Building bonuses no simple formula reproduces
// (see gb-extrapolate.ts), fitted on the wiki levels and in-game readings.
// Keyed by Great Building id, then by the column's English label.
// `readings` are values seen in game: they win over the formula and over
// data/gb-readings.json at their level.

export type ManualModel = {
  value: (level: number) => number
  readings?: Record<number, number>
}

const round2 = (value: number) => Math.round(value * 100) / 100

// Galata Tower plunder repel chance: cubic fitted on wiki levels 50-80 and the readings
// (within 0.14 point of the wiki and every reading), held at its peak (level ~227) so it never decreases
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
  rain_forest_project: {
    // Aid blueprints chance: power law fitted on wiki levels 60-80 and the readings
    // (26 of 27 exact after rounding, the last one 1 point off)
    "Aid Blueprints": {
      value: (level) => Math.round(11.9561 * level ** 0.822 + 25.037),
      readings: { 101: 556, 102: 560, 111: 599, 112: 603, 143: 732, 144: 736 },
    },
  },
  galata_tower: {
    // 6 since level 71 on the wiki, still 6 in game at level 175
    "Plunder Repel (#)": { value: () => 6 },
    // Levels 81-136 come from foe-assistant.com (data/gb-readings.json); it shows the
    // readings 123 and 124 were swapped (57.99 then 58.13)
    "Plunder Repel (%)": {
      value: galataPercent,
      readings: { 152: 61.26, 153: 61.35, 174: 62.87, 175: 62.93 },
    },
  },
}

export function manualValue(model: ManualModel, level: number): number {
  return model.readings?.[level] ?? model.value(level)
}
