// Historical allies from the game's own definitions, read in a network capture of the live
// servers cleaned by scripts/har-extract.ts (French names and texts, every value by level),
// and from the official wiki's ally pages, in the scraper's cache (English names and texts,
// pictures, icons, Valor Tokens the capture leaves out). Writes data/allies.json.
//   pnpm allies [capture folder, default scripts/.cache/har/fr] [wiki cache, default scripts/.cache/en.json]

import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import {
  ALLY_RARITIES,
  type Ally,
  type AllyAbility,
  type AllyProduction,
  type AllyRarity,
  type AllyRarityInfo,
} from "../src/core/ally"
import { loadCache } from "./scrape/wiki"

type Boost = { type: string; value: number; targetedFeature: string }
type LimitedBonus = {
  type: string
  charges: number
  chance: number
  ability: { type: string; name: string; icon?: string }
  unitClass: string
  battleType: string
}
type GameAlly = {
  id: string
  name: string
  description: string
  allyType: Ally["type"]
  levelUpCosts: Record<string, { resources: Record<string, number> }>
  rarityInfo: {
    rarity: { value: AllyRarity }
    rarityBoosts: { boost: Record<string, Boost> }[]
    evolutionCost?: { resources: Record<string, number | string> }
    limitedBonuses: Record<string, LimitedBonus[]> | []
    productionRewardData?: {
      base: Record<string, { type: string; subType?: string; id: string }>
      levelAmounts: number[]
    }
  }[]
}

const SCROLL = "historical_allies_train_manual_1"
const WIKI = "https://en.wiki.forgeofempires.com/index.php?title="

// Values by level from { "1": ..., "2": ... }
const byLevel = <T>(record: Record<string, T>) =>
  Object.entries(record)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, value]) => value)

const number = (text: string | undefined) =>
  text === undefined ? undefined : Number(text.replace(/,/g, ""))

// "era_unit#heavy_melee#NextEra#1", "goods#each#PreviousEra#1", "resource#strategy_points#1"
export function production(id: string, amounts: number[]): AllyProduction | undefined {
  const unit = id.match(/^era_unit#([a-z_]+)#(\w+)#/)
  if (unit) return { kind: "unit", unitClass: unit[1], nextEra: unit[2] === "NextEra", amounts }
  if (/^resource#strategy_points/.test(id)) return { kind: "fp", amounts }
  if (/^goods#/.test(id)) {
    const kind = /PreviousEra/.test(id) ? "goods_prev" : /NextEra/.test(id) ? "goods_next" : "goods"
    return { kind, amounts }
  }
  console.log(`Unknown production reward: ${id}`)
  return undefined
}

// Limited bonuses: one list per level, the same bonuses at every level
function abilities(limited: GameAlly["rarityInfo"][number]["limitedBonuses"]): AllyAbility[] {
  if (Array.isArray(limited)) return []
  const levels = byLevel(limited)
  return (levels[0] ?? []).map((first, index) => ({
    ability: first.ability.type,
    name: { fr: first.ability.name, en: first.ability.name },
    unitClass: first.unitClass,
    feature: first.battleType,
    ...(first.ability.icon && { icon: first.ability.icon }),
    chances: levels.map((bonuses) => bonuses[index]?.chance ?? 0),
    charges: levels.map((bonuses) => bonuses[index]?.charges ?? 0),
  }))
}

// ---- Official wiki page of an ally ----

const IMAGE = /https:\/\/[^\s|}]+\/([a-z0-9_]+?)-[0-9a-f]+\.(?:png|jpg)/g

type WikiAlly = {
  title: string
  image: string
  description: string
  // By rarity: the boosts' icons in order, limited bonuses (icon, English text), Valor Tokens
  rarities: Map<
    string,
    { boostIcons: string[]; abilities: [string, string][]; valor?: number; disband?: number }
  >
}

export function wikiAlly(title: string, content: string): [string, WikiAlly] | undefined {
  const big = content.match(
    /https:\/\/\S+\/allies_large\/historical_allies_big_([a-z0-9_]+)-[0-9a-f]+\.png/,
  )
  if (!big) return undefined
  const after = content.slice(content.indexOf(big[0]) + big[0].length)
  const description = after.slice(0, after.indexOf("\n|-")).trim()
  const rarities: WikiAlly["rarities"] = new Map()
  for (const section of content.split(/\n=== /).slice(1)) {
    const rarity = section.match(/historical_allies_ally_emblem_([a-z]+)-/)?.[1]
    if (!rarity) continue
    const block = (label: string) => section.split(`'''${label}`)[1]?.split("\n|-")[0] ?? ""
    const bullets = (text: string) =>
      [...text.matchAll(/^\* \{\{sized-external-image\|\d+px\|(\S+?)\}\} (.+)$/gm)].map(
        (m) => [m[1], m[2].trim()] as [string, string],
      )
    rarities.set(rarity, {
      boostIcons: bullets(block("Boosts:")).map(([icon]) => icon),
      abilities: bullets(block("Limited Bonuses")),
      valor: number(block("Evolution Costs:").match(/([\d,]+) \{\{[^}]*valor_token/)?.[1]),
      disband: number(block("Disband Rewards:").match(/([\d,]+) \{\{[^}]*valor_token/)?.[1]),
    })
  }
  return [big[1], { title, image: big[0], description, rarities }]
}

// ---- Both together ----

function main() {
  const capture = process.argv[2] ?? "scripts/.cache/har/fr"
  const wikiCache = process.argv[3] ?? "scripts/.cache/en.json"
  // The capture's file holding the allies' definitions (the newest one)
  const files = readdirSync(capture)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
  const source = files.find((f) => {
    const text = readFileSync(`${capture}/${f}`, "utf8")
    return text.startsWith("[") && text.includes('"__class__":"AllyMetadata"')
  })
  if (!source) throw new Error(`No ally definitions in ${capture}: run pnpm har-extract`)
  const game: GameAlly[] = JSON.parse(readFileSync(`${capture}/${source}`, "utf8"))

  const pages = loadCache(wikiCache)
  const wiki = new Map(
    Object.entries(pages).flatMap(([title, page]) => {
      const found = page?.content ? wikiAlly(title, page.content) : undefined
      return found ? [found] : []
    }),
  )
  // Icons of the production rewards, from any page
  const icons = new Map<string, string>()
  for (const page of Object.values(pages)) {
    if (!page?.content?.includes("historical_allies")) continue
    for (const [url, name] of page.content.matchAll(IMAGE)) icons.set(name, url)
  }
  const productionIcon: Record<AllyProduction["kind"], string | undefined> = {
    fp: icons.get("forgepoints"),
    goods: icons.get("random_goods"),
    goods_prev: icons.get("all_goods_of_previous_age"),
    goods_next: icons.get("all_goods_of_next_age"),
    unit: undefined,
  }

  const allies: Ally[] = game.map((g) => {
    const page = wiki.get(g.id)
    if (!page) console.log(`${g.id}: no wiki page`)
    const rarities = g.rarityInfo
      .filter((r) => ALLY_RARITIES.includes(r.rarity.value))
      .map((r, index): AllyRarityInfo => {
        const fromWiki = page?.rarities.get(r.rarity.value)
        // Each rarity lists every boost so far: its own come after the earlier ones'
        const earlier = g.rarityInfo.slice(0, index).flatMap((x) => x.rarityBoosts).length
        const boosts = r.rarityBoosts.map(({ boost }, k) => {
          const levels = byLevel(boost)
          const icon = fromWiki?.boostIcons[earlier + k]
          return {
            type: levels[0].type,
            feature: levels[0].targetedFeature,
            ...(icon && { icon }),
            values: levels.map((b) => b.value),
          }
        })
        const data = r.productionRewardData
        const made = data && production(Object.values(data.base)[0].id, data.levelAmounts.slice(1))
        const icon = made && productionIcon[made.kind]
        const scrolls = r.evolutionCost?.resources[SCROLL]
        const ownAbilities = abilities(r.limitedBonuses).map((a) => {
          // English name and icon from the wiki's text of level 1
          const line = fromWiki?.abilities.find(([url]) => url.includes(`/${a.icon ?? a.ability}-`))
          const en = line?.[1].match(/grant (.+?) to \d/)?.[1]
          return {
            ...a,
            name: { fr: a.name.fr, en: en ?? a.name.fr },
            ...(line && { icon: line[0] }),
          }
        })
        return {
          rarity: r.rarity.value,
          boosts,
          production: made ? [{ ...made, ...(icon && { icon }) }] : [],
          abilities: ownAbilities,
          evolution: {
            ...(fromWiki?.valor && { valor: fromWiki.valor }),
            ...(typeof scrolls === "number" && { scrolls }),
          },
          ...(fromWiki?.disband && { disband: fromWiki.disband }),
        }
      })
    return {
      id: g.id,
      name: { fr: g.name, en: page?.title ?? g.name },
      description: { fr: g.description, en: page?.description ?? g.description },
      type: g.allyType,
      ...(page && {
        image: page.image,
        sourceUrl: WIKI + encodeURIComponent(page.title.replace(/ /g, "_")),
      }),
      levelCosts: byLevel(g.levelUpCosts).map((cost) => cost.resources[SCROLL] ?? 0),
      rarities,
    }
  })
  writeFileSync("data/allies.json", JSON.stringify(allies) + "\n")
  console.log(`${allies.length} allies in data/allies.json`)
}

if (process.argv[1]?.endsWith("allies.ts")) main()
