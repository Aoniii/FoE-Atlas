// Merges the game's own building definitions (data/game-buildings.json) with the wiki's
// buildings (data/buildings): a building the wiki knows keeps its id, French and English
// names, picture and event, and takes the game's values, size, road and links; the others
// are added from the game alone (name in the export's language until the wiki has them).

import type { Building } from "../src/core/building"
import type { GameBuilding } from "../src/core/game-building"
import { eventFromAsset } from "./scrape/events"
import type { WikiPages } from "./scrape/pages"

// "W_MultiAge_HERO24H1" -> picture name "W_SS_MultiAge_HERO24H1", as in the wiki's image URLs
export const pictureOf = (assetId: string) => assetId.replace(/^([A-Z])_/, "$1_SS_")

// Game asset id from a wiki image URL: .../W_SS_MultiAge_HERO24H1-<hash>.png
export function assetOfImage(image: string | undefined): string | undefined {
  const file = image?.match(/\/([A-Z])_SS_([^/]+?)-[0-9a-f]+\.\w+$/)
  return file ? `${file[1]}_${file[2]}` : undefined
}

const sameName = (a: string, b: string) =>
  a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase()

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")

// Level written in a title: "Ritual Flame - Lv. 2", "Flamme rituelle - Niv. 2"
const level = (title: string) => Number(title.match(/(?:Lv|Niv)\.\s*(\d+)\s*$/i)?.[1] ?? 1)

// English and French titles and picture of a building known only from the game, from the
// wiki pages sharing its picture: same level, the city version rather than the Quantum
// Incursion ones ("Amphitheater (Quantum Incursion)")
function fromWikiPages(g: GameBuilding, pages: WikiPages) {
  const page = pages[g.assetId]
  if (!page) return undefined
  const wanted = level(g.name)
  const pick = (titles: string[]) =>
    titles
      .filter((title) => level(title) === wanted)
      .sort((a, b) => Number(a.includes("(")) - Number(b.includes("(")) || a.length - b.length)[0]
  const fr = page.fr.find((title) => sameName(title, g.name)) ?? pick(page.fr)
  const en = pick(page.en)
  return en ? { en, fr: fr ?? g.name, image: page.image } : undefined
}

const pageUrl = (title: string) =>
  `https://en.wiki.forgeofempires.com/index.php?title=${encodeURIComponent(title.replace(/ /g, "_"))}`

export function mergeGameBuildings(
  wiki: Building[],
  game: GameBuilding[],
  pages: WikiPages = {},
): Building[] {
  const byAsset = new Map<string, Building[]>()
  for (const building of wiki) {
    const asset = assetOfImage(building.image)
    if (asset) byAsset.set(asset, [...(byAsset.get(asset) ?? []), building])
  }
  const ids = new Set(wiki.map((b) => b.id))
  const merged = new Set<string>()
  const result: Building[] = []
  for (const g of game) {
    const candidates = (byAsset.get(g.assetId) ?? []).filter((b) => !merged.has(b.id))
    // Levels of a chain can share a picture: then the French name decides
    const match =
      candidates.find((b) => sameName(b.name.fr, g.name)) ??
      (candidates.length === 1 ? candidates[0] : undefined)
    const fromGame = {
      size: g.size,
      road: g.road,
      ages: g.ages,
      gameId: g.gameId,
      ...(g.links && { links: g.links }),
    }
    if (match) {
      merged.add(match.id)
      result.push({ ...match, ...fromGame })
      continue
    }
    const named = fromWikiPages(g, pages)
    let id = slug(named?.en ?? g.gameId)
    while (ids.has(id)) id = `${id}_${slug(g.gameId)}`
    ids.add(id)
    const event = eventFromAsset(pictureOf(g.assetId))
    result.push({
      id,
      name: named ? { fr: named.fr, en: named.en } : { fr: g.name, en: g.name },
      type: g.type,
      ...(named && { image: named.image, sourceUrl: pageUrl(named.en) }),
      ...(event && { event: event.event, ...(event.year && { eventYear: event.year }) }),
      reliability: "official",
      ...fromGame,
    })
  }
  return [...result, ...wiki.filter((b) => !merged.has(b.id))]
}

// Upgrade levels the wiki did not link ("Place des vainqueurs - Niv. 1", "- Niv. 2"): buildings
// sharing a French name but for an explicit level, one building per level
const LEVEL = /\s*-?\s*(?:Niv|Lv)\.\s*(\d+)\s*$/i

export function fillLevelChains(buildings: Building[]): Building[] {
  const groups = new Map<string, Building[]>()
  for (const building of buildings) {
    if (building.chain || !LEVEL.test(building.name.fr)) continue
    const base = building.name.fr.replace(LEVEL, "").trim().toLowerCase()
    groups.set(base, [...(groups.get(base) ?? []), building])
  }
  const chains = new Map<string, NonNullable<Building["chain"]>>()
  for (const group of groups.values()) {
    const levels = group.map((b) => Number(b.name.fr.match(LEVEL)![1]))
    if (group.length < 2 || new Set(levels).size !== levels.length) continue
    const id =
      slug(group[0].name.en.replace(LEVEL, "")) || slug(group[0].name.fr.replace(LEVEL, ""))
    group.forEach((building, index) => chains.set(building.id, { id, level: levels[index] }))
  }
  return buildings.map((b) => (chains.has(b.id) ? { ...b, chain: chains.get(b.id) } : b))
}
