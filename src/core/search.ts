import type { AgeId } from "./ages"
import type { Building } from "./building"

// Special buildings, and Great Buildings (kind + their age instead of an event)
export type SearchEntry = Pick<Building, "id" | "name" | "image" | "event" | "eventYear"> & {
  kind?: "great_building"
  age?: AgeId
}

// "Château d'Été" -> "chateau d ete": accents, case and punctuation do not matter
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

// Every word of the query must appear in the French or English name.
// Best first: name starting with the query, then a word starting with it, then anywhere;
// the current language before the other one, shorter names first.
export function searchBuildings(
  entries: SearchEntry[],
  query: string,
  locale: string,
  limit = 50,
): SearchEntry[] {
  const words = normalize(query).split(" ").filter(Boolean)
  if (!words.length) return []
  const full = words.join(" ")
  const primary = locale === "en" ? "en" : "fr"
  const secondary = primary === "en" ? "fr" : "en"

  const rank = (name: string) => {
    const text = normalize(name)
    if (!words.every((word) => text.includes(word))) return undefined
    if (text.startsWith(full)) return 0
    if (` ${text}`.includes(` ${full}`)) return 1
    return 2
  }

  return entries
    .flatMap((entry) => {
      const own = rank(entry.name[primary])
      const other = rank(entry.name[secondary])
      if (own === undefined && other === undefined) return []
      const score = Math.min(own ?? 9, (other ?? 9) + 0.5)
      return [{ entry, score }]
    })
    .sort(
      (a, b) => a.score - b.score || a.entry.name[primary].length - b.entry.name[primary].length,
    )
    .slice(0, limit)
    .map(({ entry }) => entry)
}
