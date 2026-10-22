// Every building page of the wiki caches (scripts/.cache/en.json and fr.json), indexed by the
// game asset id of its picture: English and French titles and the picture. scripts/build-data.ts
// uses it to name and picture the buildings known only from the game (houses, goods...).
// Run by the scraper, or alone without any request:
//   pnpm wiki-pages

import { writeFileSync } from "node:fs"
import { loadCache } from "./wiki"

const BUILDING_IMAGE =
  /https:\/\/[^\s|}]+\/assets\/city\/buildings\/([A-Z])_SS_([A-Za-z0-9_]+?)(?:-[0-9a-f]+)?\.png/

const INFO_BOX = /'''(Type|Size|Taille) ?:'''/

export type WikiPages = Record<string, { image: string; en: string[]; fr: string[] }>

// Placeholder and test pages of the wiki
const isPlaceholder = (title: string) => /^(Dummy|Placeholder)\b|\bTest\b/.test(title)

export function wikiPages(
  en: Record<string, { content: string }>,
  fr: Record<string, { content: string }>,
): WikiPages {
  const pages: WikiPages = {}
  const add = (lang: "en" | "fr", cache: Record<string, { content: string }>) => {
    for (const [title, page] of Object.entries(cache)) {
      // One building per page: its info box (type or size line) and its picture first
      if (isPlaceholder(title) || !INFO_BOX.test(page.content)) continue
      const match = page.content.match(BUILDING_IMAGE)
      if (!match) continue
      const asset = `${match[1]}_${match[2]}`
      const entry = (pages[asset] ??= { image: match[0], en: [], fr: [] })
      // English pictures: same file on the English image server
      if (lang === "en") entry.image = match[0]
      entry[lang].push(title)
    }
  }
  add("en", en)
  add("fr", fr)
  return pages
}

export function writeWikiPages(cacheDir: string) {
  const pages = wikiPages(loadCache(`${cacheDir}/en.json`), loadCache(`${cacheDir}/fr.json`))
  writeFileSync("data/wiki-pages.json", JSON.stringify(pages) + "\n")
  return Object.keys(pages).length
}

if (process.argv[1]?.endsWith("pages.ts")) {
  console.log(`${writeWikiPages("scripts/.cache")} pictures in data/wiki-pages.json`)
}
