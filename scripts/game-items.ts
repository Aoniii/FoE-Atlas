// Inventory items that place or upgrade buildings, from the game's metadata saved by
// scripts/har-extract.ts: upgrade kits and the upgrade paths they follow
// (building_upgrade_paths), and selection kits (selection_kits). The language of each capture
// comes from its image server (foefr: French, foeen and the beta server foezz: English); the
// names of a language missing from every capture are the other language's. Item pictures come
// from the wiki caches (scripts/.cache/en.json, fr.json). Writes data/game-items.json.
//   pnpm game-items [capture ...]   (default: every folder of scripts/.cache/har)

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import {
  pathLevels,
  type GameItem,
  type GameItems,
  type KitOption,
  type UpgradePath,
} from "../src/core/game-item"

const HAR = "scripts/.cache/har"

type Lang = "fr" | "en"

type RawUpgradeItem = {
  id: string
  name: string
  description?: string
  iconAssetName?: string
  flags?: string[]
}
type RawPath = {
  baseBuildingId: string
  upgradeItems: Record<string, RawUpgradeItem>
  upgradeSteps: { fromBuildingId: string; toBuildingId: string; upgradeItemId: string }[]
  __class__: "BuildingUpgradePath"
}
type RawKit = {
  selectionKitId: string
  name: string
  description?: string
  options: {
    name: string
    item: { cityEntityId?: string; level?: number; upgradeItemId?: string }
  }[]
  __class__: "SelectionKitMetadata"
}

function language(folder: string): Lang | undefined {
  const index = readFileSync(`${folder}/index.json`, "utf8")
  const host = index.match(/https:\/\/foe([a-z]{2})\.innogamescdn\.com/)?.[1]
  return host === "fr" ? "fr" : host === "en" || host === "zz" ? "en" : undefined
}

// Lists of the given class among the capture's metadata files
function metadata<T>(folder: string, className: string): T[] {
  for (const file of readdirSync(folder)) {
    if (!file.includes("_metadata")) continue
    const text = readFileSync(`${folder}/${file}`, "utf8")
    if (!text.startsWith("[") || !text.includes(`"__class__":"${className}"`)) continue
    return JSON.parse(text) as T[]
  }
  return []
}

// Item picture URLs of the wiki pages: .../reward_icons/reward_icon_<asset>-<hash>.png
function wikiIcons(): Map<string, string> {
  const icons = new Map<string, string>()
  for (const lang of ["fr", "en"]) {
    const file = `scripts/.cache/${lang}.json`
    if (!existsSync(file)) continue
    const urls = readFileSync(file, "utf8").matchAll(
      /https:\/\/[a-z0-9.]+\/assets\/shared\/icons\/reward_icons\/reward_icon_([A-Za-z0-9_]+)-[0-9a-f]+\.png/g,
    )
    for (const [url, asset] of urls) icons.set(asset, url)
  }
  return icons
}

function main() {
  const folders = (
    process.argv.length > 2
      ? process.argv.slice(2).map((name) => (name.includes("/") ? name : `${HAR}/${name}`))
      : readdirSync(HAR).map((name) => `${HAR}/${name}`)
  )
    .filter((folder) => existsSync(`${folder}/index.json`))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  if (!folders.length) throw new Error(`No capture in ${HAR} (pnpm har-extract)`)

  const icons = wikiIcons()
  const items = new Map<string, GameItem>()
  const paths = new Map<string, UpgradePath>()
  const named = new Map<string, Partial<Record<Lang, { name: string; description: string }>>>()
  const options = new Map<string, Partial<Record<Lang, string>>[]>()
  // Index, among the kit's options, of each option kept (buildings and upgrade kits)
  const kept = new Map<string, number[]>()
  const sources: string[] = []

  for (const folder of folders) {
    const lang = language(folder)
    if (!lang) {
      console.log(`${folder}: unknown language, skipped`)
      continue
    }
    const rawPaths = metadata<RawPath>(folder, "BuildingUpgradePath")
    const rawKits = metadata<RawKit>(folder, "SelectionKitMetadata")
    if (!rawPaths.length && !rawKits.length) continue
    sources.push(`${folder.split("/").at(-1)} (${lang})`)
    const name = (id: string, text: string, description = "") =>
      named.set(id, {
        ...named.get(id),
        [lang]: named.get(id)?.[lang] ?? { name: text, description },
      })

    for (const path of rawPaths) {
      const steps = path.upgradeSteps.map((s) => ({
        from: s.fromBuildingId,
        to: s.toBuildingId,
        item: s.upgradeItemId,
      }))
      if (!paths.has(path.baseBuildingId)) {
        paths.set(path.baseBuildingId, {
          base: path.baseBuildingId,
          levels: pathLevels(path.baseBuildingId, steps),
        })
      }
      for (const raw of Object.values(path.upgradeItems)) {
        name(raw.id, raw.name, raw.description)
        const item = items.get(raw.id) ?? {
          id: raw.id,
          kind: "upgrade_kit" as const,
          name: { fr: "", en: "" },
          description: { fr: "", en: "" },
          ...(raw.iconAssetName &&
            icons.has(raw.iconAssetName) && { icon: icons.get(raw.iconAssetName) }),
          ...(raw.flags?.[0] && { rarity: raw.flags[0] }),
          upgrades: [],
        }
        for (const step of steps.filter((s) => s.item === raw.id)) {
          if (!item.upgrades!.some((u) => u.from === step.from && u.to === step.to)) {
            item.upgrades!.push({ from: step.from, to: step.to })
          }
        }
        items.set(raw.id, item)
      }
    }

    for (const kit of rawKits) {
      name(kit.selectionKitId, kit.name, kit.description)
      const names = options.get(kit.selectionKitId) ?? []
      kit.options.forEach((option, i) => (names[i] = { ...names[i], [lang]: option.name }))
      options.set(kit.selectionKitId, names)
      if (items.has(kit.selectionKitId)) continue
      const indices = kit.options.flatMap((option, i) =>
        option.item.cityEntityId || option.item.upgradeItemId ? [i] : [],
      )
      kept.set(kit.selectionKitId, indices)
      items.set(kit.selectionKitId, {
        id: kit.selectionKitId,
        kind: "selection_kit",
        name: { fr: "", en: "" },
        description: { fr: "", en: "" },
        ...(icons.has(kit.selectionKitId) && { icon: icons.get(kit.selectionKitId) }),
        options: indices.map((i): KitOption => {
          const { cityEntityId, level = 1, upgradeItemId } = kit.options[i].item
          return cityEntityId
            ? { name: { fr: "", en: "" }, building: { gameId: cityEntityId, level } }
            : { name: { fr: "", en: "" }, item: upgradeItemId }
        }),
      })
    }
  }

  // Names in both languages, the other one when a language is missing
  const both = (texts: Partial<Record<Lang, string>> | undefined) => ({
    fr: texts?.fr ?? texts?.en ?? "",
    en: texts?.en ?? texts?.fr ?? "",
  })
  for (const item of items.values()) {
    const texts = named.get(item.id)
    item.name = both({ fr: texts?.fr?.name, en: texts?.en?.name })
    item.description = both({ fr: texts?.fr?.description, en: texts?.en?.description })
    const names = options.get(item.id) ?? []
    item.options?.forEach((option, i) => (option.name = both(names[kept.get(item.id)![i]])))
  }

  const result: GameItems = {
    sources,
    items: [...items.values()].sort((a, b) => a.id.localeCompare(b.id)),
    paths: [...paths.values()].sort((a, b) => a.base.localeCompare(b.base)),
  }
  writeFileSync("data/game-items.json", JSON.stringify(result) + "\n")
  const withIcon = result.items.filter((item) => item.icon).length
  console.log(
    `${result.items.length} items (${withIcon} with a picture), ${result.paths.length} upgrade paths`,
  )
}

main()
