import type { BuildingPage } from "@/core/building"

const LEVEL_SUFFIX = /\s*-\s*(Lv|Niv)\.\s*\d+\s*$/

const words = (text: string) => text.split(/\s+/).filter(Boolean)
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// Short name of each step of a chain: numbered levels show their number, kit upgrades
// only what they add to the first level ("Sylvan Whisperwood Watermill" -> "Sylvan").
// English adjectives come first: the added words are the ones missing from the first
// level. French ones come last, and translations vary ("Whisperwood" / "bois murmurant"):
// keep the same number of words, from the end ("… paradisiaque supérieur").
export function chainStepLabels(
  levels: Pick<BuildingPage["chainLevels"][number], "id" | "level" | "name">[],
): Map<string, { fr: string; en: string }> {
  const labels = new Map<string, { fr: string; en: string }>()
  const first = levels[0]
  if (!first) return labels
  const baseWords = new Set(words(first.name.en.replace(LEVEL_SUFFIX, "").toLowerCase()))

  for (const level of levels) {
    if (LEVEL_SUFFIX.test(level.name.en)) {
      labels.set(level.id, { fr: String(level.level), en: String(level.level) })
      continue
    }
    const added = words(level.name.en).filter((word) => !baseWords.has(word.toLowerCase()))
    if (!added.length || added.length >= words(level.name.en).length) {
      labels.set(level.id, level.name)
      continue
    }
    const fr = words(level.name.fr).slice(-added.length).join(" ")
    labels.set(level.id, { fr: capitalize(fr), en: added.join(" ") })
  }
  return labels
}
