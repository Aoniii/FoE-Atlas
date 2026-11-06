// Bundles data/buildings/*.json into one light file per age for the site:
//   public/data/index.json      meta + available ages
//   public/data/<AgeId>.json    every building available in that age, with that age's data only
//   public/data/buildings/<id>.json   one building with all its ages and its other levels
//   public/data/search.json     names of every building for the search bar
//   public/data/great-buildings.json         Great Buildings grid (name, image, age, tier)
//   public/data/great-buildings/<id>.json    one Great Building with its prestige data

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { AGE_IDS, type AgeId } from "../src/core/ages"
import {
  BuildingSchema,
  type AgeBuilding,
  type AgeData,
  type Building,
  type BuildingPage,
} from "../src/core/building"
import { aggregateStats } from "../src/core/efficiency"
import { COPPER_MAX_LEVEL, type Prestige } from "../src/core/gb-prestige"
import {
  GreatBuildingSchema,
  type GreatBuilding,
  type GreatBuildingCard,
} from "../src/core/great-building"
import type { GameBuilding } from "../src/core/game-building"
import type { Ally, AllyCard } from "../src/core/ally"
import type {
  EventCard,
  EventGuide,
  EventPage,
  EventPrize,
  EventQuest,
  GameEvent,
} from "../src/core/event"
import { eventTranslator } from "./event-texts"
import type { GameItems, ItemBuilding, ItemCard, ItemPage } from "../src/core/game-item"
import { applyUpgradePaths, assetOfImage, fillLevelChains, mergeGameBuildings } from "./merge-game"
import type { SearchEntry } from "../src/core/search"

const SOURCE = "data/buildings"
const OUTPUT = "public/data"

const wikiBuildings = readdirSync(SOURCE)
  .filter((file) => file.endsWith(".json"))
  .map((file) => BuildingSchema.parse(JSON.parse(readFileSync(`${SOURCE}/${file}`, "utf8"))))
// Every building of the game, with the game's values (scripts/game-data.ts)
const gameBuildings: GameBuilding[] = existsSync("data/game-buildings.json")
  ? JSON.parse(readFileSync("data/game-buildings.json", "utf8")).buildings
  : []
// English and French titles and pictures of the wiki pages (scripts/scrape/pages.ts)
const wikiPages = existsSync("data/wiki-pages.json")
  ? JSON.parse(readFileSync("data/wiki-pages.json", "utf8"))
  : {}
// Upgrade and selection kits, and the game's upgrade paths (scripts/game-items.ts)
// Historical allies (scripts/allies.ts)
const allies: Ally[] = existsSync("data/allies.json")
  ? JSON.parse(readFileSync("data/allies.json", "utf8"))
  : []
const gameItems: GameItems = existsSync("data/game-items.json")
  ? JSON.parse(readFileSync("data/game-items.json", "utf8"))
  : { sources: [], items: [], paths: [] }
// Levels from the game's upgrade paths, then from the names for the buildings outside them
const buildings = fillLevelChains(
  applyUpgradePaths(mergeGameBuildings(wikiBuildings, gameBuildings, wikiPages), gameItems.paths),
).map((b) => BuildingSchema.parse(b))
const meta = JSON.parse(readFileSync("data/meta.json", "utf8"))
const icons = existsSync("data/icons.json")
  ? JSON.parse(readFileSync("data/icons.json", "utf8"))
  : {}

// Files are replaced in place, never the whole folder: the Vite dev server
// stops serving a public folder that is deleted and recreated
mkdirSync(OUTPUT, { recursive: true })
const written = new Set(["index.json", "search.json", "great-buildings.json", "assets.json"])

const ages: { id: AgeId; buildings: number }[] = []
for (const ageId of AGE_IDS) {
  const list: AgeBuilding[] = buildings.flatMap(({ ages: all, ...building }) => {
    const age = all[ageId]
    return age ? [{ ...building, age }] : []
  })
  if (!list.length) continue
  writeFileSync(`${OUTPUT}/${ageId}.json`, JSON.stringify(list))
  written.add(`${ageId}.json`)
  ages.push({ id: ageId, buildings: list.length })
}

writeFileSync(
  `${OUTPUT}/index.json`,
  JSON.stringify({
    gameVersion: meta.gameVersion,
    scrapedAt: meta.scrapedAt,
    ages,
    icons,
    // Building types with data, for the type filter
    types: [
      ...new Set(buildings.map((b) => b.type)),
      ...(existsSync("data/great-buildings") ? ["great_building"] : []),
      ...(gameItems.items.length ? ["item"] : []),
      ...(allies.length ? ["ally"] : []),
    ],
  }),
)
for (const file of readdirSync(OUTPUT)) {
  if (
    ![
      "buildings",
      "great-buildings",
      "items",
      "items.json",
      "events",
      "events.json",
      "allies",
      "allies.json",
    ].includes(file) &&
    !written.has(file)
  ) {
    rmSync(`${OUTPUT}/${file}`)
  }
}

// Light index for the search bar: names, image and source only
const search: SearchEntry[] = buildings.map(({ id, name, image, event, eventYear }) => ({
  id,
  name,
  image,
  event,
  eventYear,
}))
writeFileSync(`${OUTPUT}/search.json`, JSON.stringify(search))

// One file per building for its own page, with the other levels of its chain
const BUILDINGS_OUTPUT = `${OUTPUT}/buildings`
mkdirSync(BUILDINGS_OUTPUT, { recursive: true })
const levelsByChain = new Map<string, BuildingPage["chainLevels"]>()
for (const building of buildings) {
  if (!building.chain) continue
  const levels = levelsByChain.get(building.chain.id) ?? []
  const stats = Object.fromEntries(
    Object.entries(building.ages).map(([age, data]) => [age, aggregateStats(data!)]),
  )
  levels.push({
    id: building.id,
    level: building.chain.level,
    name: building.name,
    size: building.size,
    road: building.road,
    stats,
  })
  levelsByChain.set(building.chain.id, levels)
}
// Buildings that link with each one: the other buildings of its chain (start and links, with
// what a link adds) or of its set
const byLink = new Map<string, Building[]>()
for (const building of buildings) {
  for (const key of [
    building.links?.chain && `chain:${building.links.chain.id}`,
    building.links?.set && `set:${building.links.set.id}`,
  ]) {
    if (key) byLink.set(key, [...(byLink.get(key) ?? []), building])
  }
}
const statsByAge = (ages: Partial<Record<string, AgeData>> | undefined) =>
  ages &&
  Object.fromEntries(Object.entries(ages).map(([age, data]) => [age, aggregateStats(data!)]))
function linkedBuildings(building: Building): BuildingPage["linkedBuildings"] {
  const chain = building.links?.chain
  const set = building.links?.set
  // A start shows its links, a link the starts (their highest level only), a set the others
  const chainPartners = (chain ? (byLink.get(`chain:${chain.id}`) ?? []) : []).filter(
    (b) => b.links!.chain!.role !== chain!.role || chain!.role === "link",
  )
  const setPartners = set ? (byLink.get(`set:${set.id}`) ?? []) : []
  const highest = (b: Building) =>
    b.links!.chain!.role !== "start" ||
    !b.chain ||
    !chainPartners.some((o) => o.chain?.id === b.chain!.id && o.chain.level > b.chain!.level)
  const partners = [
    ...chainPartners.filter((b) =>
      b.links!.chain!.role === "start"
        ? chain!.role === "link" && highest(b)
        : chain!.role === "start",
    ),
    ...setPartners.filter(
      // One level of each upgradable building: the highest
      (b) =>
        !b.chain ||
        !setPartners.some((o) => o.chain?.id === b.chain!.id && o.chain.level > b.chain!.level),
    ),
  ].filter((b, index, all) => b.id !== building.id && all.findIndex((o) => o.id === b.id) === index)
  return partners.map((b) => ({
    id: b.id,
    name: b.name,
    ...(b.image && { image: b.image }),
    role: b.links?.chain?.id === chain?.id && chain ? b.links!.chain!.role : "set",
    ...(b.links?.chain?.bonus &&
      b.links.chain.id === chain?.id && { bonus: statsByAge(b.links.chain.bonus) }),
  }))
}

// Inventory items: a light list for the wiki grid and the search, one file per item with the
// buildings it places or upgrades, and on each building page the items that give it
const ITEMS_OUTPUT = `${OUTPUT}/items`
mkdirSync(ITEMS_OUTPUT, { recursive: true })
const byGameId = new Map(buildings.flatMap((b) => (b.gameId ? [[b.gameId, b] as const] : [])))
const itemBuilding = (gameId: string): ItemBuilding => {
  const b = byGameId.get(gameId)
  return b ? { id: b.id, name: b.name, image: b.image } : { name: { fr: gameId, en: gameId } }
}
const itemCards = new Map<string, ItemCard>()
for (const item of gameItems.items) {
  const gives = item.upgrades?.[0]?.to ?? item.options?.find((o) => o.building)?.building?.gameId
  const image = item.icon ?? (gives ? byGameId.get(gives)?.image : undefined)
  itemCards.set(item.id, {
    id: item.id,
    kind: item.kind,
    name: item.name,
    ...(item.rarity && { rarity: item.rarity }),
    ...(image && { image }),
  })
}
const itemsOf = new Map<string, NonNullable<BuildingPage["items"]>>()
const giveItem = (
  gameId: string,
  card: ItemCard,
  role: NonNullable<BuildingPage["items"]>[number]["role"],
) => {
  const id = byGameId.get(gameId)?.id
  if (!id) return
  const list = itemsOf.get(id) ?? []
  if (!list.some((i) => i.id === card.id && i.role === role)) list.push({ ...card, role })
  itemsOf.set(id, list)
}
const itemFiles = new Set<string>()
for (const item of gameItems.items) {
  const card = itemCards.get(item.id)!
  const page: ItemPage = {
    ...card,
    description: item.description,
    ...(item.upgrades && {
      upgrades: item.upgrades.map(({ from, to }) => {
        giveItem(to, card, "reaches")
        giveItem(from, card, "upgrades")
        return { from: itemBuilding(from), to: itemBuilding(to) }
      }),
    }),
    ...(item.options && {
      options: item.options.map((option) => {
        if (option.building) giveItem(option.building.gameId, card, "places")
        const linked = option.item ? itemCards.get(option.item) : undefined
        return {
          name: option.name,
          ...(option.building && {
            building: { ...itemBuilding(option.building.gameId), level: option.building.level },
          }),
          ...(linked && { item: linked }),
        }
      }),
    }),
  }
  writeFileSync(`${ITEMS_OUTPUT}/${item.id}.json`, JSON.stringify(page))
  itemFiles.add(`${item.id}.json`)
}
for (const file of readdirSync(ITEMS_OUTPUT))
  if (!itemFiles.has(file)) rmSync(`${ITEMS_OUTPUT}/${file}`)
writeFileSync(`${OUTPUT}/items.json`, JSON.stringify([...itemCards.values()]))

const pages = new Set<string>()
for (const building of buildings) {
  const chainLevels = building.chain
    ? (levelsByChain.get(building.chain.id) ?? []).sort((a, b) => a.level - b.level)
    : []
  const page: BuildingPage = {
    ...building,
    chainLevels,
    linkedBuildings: linkedBuildings(building),
    items: itemsOf.get(building.id) ?? [],
  }
  writeFileSync(`${BUILDINGS_OUTPUT}/${building.id}.json`, JSON.stringify(page))
  pages.add(`${building.id}.json`)
}
for (const file of readdirSync(BUILDINGS_OUTPUT)) {
  if (!pages.has(file)) rmSync(`${BUILDINGS_OUTPUT}/${file}`)
}

// Great Buildings since the prestige rework: the game's data (scripts/gb-prestige.ts) and the
// level costs past 10 from FoE Helper (scripts/gb-rewards.ts, AGPL-3.0)
const gbPrestige: Record<string, Prestige> = existsSync("data/gb-prestige.json")
  ? JSON.parse(readFileSync("data/gb-prestige.json", "utf8")).buildings
  : {}
const gbCosts: { steps: Record<string, number[]>; linear: string[] } = existsSync(
  "data/gb-rewards.json",
)
  ? JSON.parse(readFileSync("data/gb-rewards.json", "utf8"))
  : { steps: {}, linear: [] }
const prestigeOf = (id: string): Prestige | undefined => {
  const prestige = gbPrestige[id]
  if (!prestige) return undefined
  const steps = gbCosts.steps[prestige.gameId]
  const linear = gbCosts.linear.includes(prestige.gameId)
  if (!steps && !linear) console.log(`${id}: no level costs past 10 (FoE Helper)`)
  return { ...prestige, ...(steps && { steps }), ...(linear && { linear }) }
}

// Great Buildings: a light grid file and one file per building
const GB_SOURCE = "data/great-buildings"
const GB_OUTPUT = `${OUTPUT}/great-buildings`
const greatBuildings = existsSync(GB_SOURCE)
  ? readdirSync(GB_SOURCE)
      .filter((file) => file.endsWith(".json"))
      .map((file) =>
        GreatBuildingSchema.parse(JSON.parse(readFileSync(`${GB_SOURCE}/${file}`, "utf8"))),
      )
  : []
mkdirSync(GB_OUTPUT, { recursive: true })
const cards: GreatBuildingCard[] = greatBuildings.map(({ id, name, image, age }) => ({
  id,
  name,
  image,
  age,
  // Highest tier
  ...(gbPrestige[id] && {
    tier: gbPrestige[id].maxLevel > COPPER_MAX_LEVEL ? "gold" : "copper",
  }),
}))
writeFileSync(`${OUTPUT}/great-buildings.json`, JSON.stringify(cards))
// Game asset id -> building or Great Building id, to recognize the buildings of a player's
// city (City tab). Our images are named after the asset with "SS_" after its first letter:
// .../W_SS_MultiAge_HERO24H1-<hash>.png is the game's W_MultiAge_HERO24H1
const assets = {
  buildings: {} as Record<string, string>,
  greatBuildings: {} as Record<string, string>,
}
for (const { id, image, gameId } of buildings) {
  const asset = assetOfImage(image)
  if (asset) assets.buildings[asset] = id
  if (gameId) assets.buildings[gameId] = id
}
for (const { id, image } of greatBuildings) {
  const asset = assetOfImage(image)
  if (asset) assets.greatBuildings[asset] = id
}
writeFileSync(`${OUTPUT}/assets.json`, JSON.stringify(assets))

// Great Buildings are searchable too
const gbSearch: SearchEntry[] = greatBuildings.map(({ id, name, image, age }) => ({
  id,
  name,
  image,
  age,
  kind: "great_building",
}))
// And the inventory items
const itemSearch: SearchEntry[] = [...itemCards.values()].map(({ id, name, image }) => ({
  id,
  name,
  image,
  kind: "item",
}))
// And the historical allies
const allySearch: SearchEntry[] = allies.map(({ id, name, image }) => ({
  id,
  name,
  image,
  kind: "ally",
}))
writeFileSync(
  `${OUTPUT}/search.json`,
  JSON.stringify([...search, ...gbSearch, ...itemSearch, ...allySearch]),
)

// Ally grid, one file per ally
const ALLIES_OUTPUT = `${OUTPUT}/allies`
mkdirSync(ALLIES_OUTPUT, { recursive: true })
for (const file of readdirSync(ALLIES_OUTPUT)) rmSync(`${ALLIES_OUTPUT}/${file}`)
for (const ally of allies) writeFileSync(`${ALLIES_OUTPUT}/${ally.id}.json`, JSON.stringify(ally))
const allyCards: AllyCard[] = allies.map(({ id, name, type, image }) => ({ id, name, type, image }))
writeFileSync(`${OUTPUT}/allies.json`, JSON.stringify(allyCards))

// Each Great Building as the wiki describes it (the level table of the old system left out),
// with its prestige data
const gbFiles = new Set<string>()
for (const { levels: _levels, ...gb } of greatBuildings) {
  const prestige = prestigeOf(gb.id)
  if (!prestige) console.log(`${gb.id}: no prestige data (data/gb-prestige.json)`)
  const page: GreatBuilding = { ...gb, ...(prestige && { prestige }) }
  writeFileSync(`${GB_OUTPUT}/${gb.id}.json`, JSON.stringify(page))
  gbFiles.add(`${gb.id}.json`)
}
for (const file of readdirSync(GB_OUTPUT)) if (!gbFiles.has(file)) rmSync(`${GB_OUTPUT}/${file}`)

// Events (scripts/events.ts): a light list for their grid, one file per event with each
// prize linked to its building or item page when the site has it (same English name:
// "Lost Castle – Lv. 1", "50 Fragments of Mystery Castle Silver Selection Kit (x50)")
const EVENTS = "data/events"
const EVENTS_OUTPUT = `${OUTPUT}/events`
mkdirSync(EVENTS_OUTPUT, { recursive: true })
const nameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/^\d+ fragments of /, "")
    .replace(/\s*\(x\d+\)$/, "")
    .replace(/\s+/g, " ")
    .trim()
const prizeLinks = new Map<string, NonNullable<EventPrize["link"]>>()
for (const card of itemCards.values()) {
  prizeLinks.set(nameKey(card.name.en), {
    kind: "item",
    id: card.id,
    name: card.name,
    image: card.image,
  })
}
for (const b of buildings) {
  prizeLinks.set(nameKey(b.name.en), { kind: "building", id: b.id, name: b.name, image: b.image })
}
for (const ally of allies) {
  prizeLinks.set(nameKey(ally.name.en), {
    kind: "ally",
    id: ally.id,
    name: ally.name,
    image: ally.image,
  })
}
const eventTexts = JSON.parse(readFileSync("data/event-texts.json", "utf8"))
const { translate, missing: untranslated } = eventTranslator(eventTexts.fr, eventTexts.en)
const translateQuest = (q: EventQuest) => ({
  n: q.n,
  text: translate(q.text),
  reward: translate(q.reward),
})
// Start on the live servers, when known (the article only covers the beta)
const eventLive: Record<string, string> = existsSync("data/event-live.json")
  ? JSON.parse(readFileSync("data/event-live.json", "utf8"))
  : {}
// How each event works, written by hand
const eventGuides: Record<string, EventGuide> = existsSync("data/event-guides.json")
  ? JSON.parse(readFileSync("data/event-guides.json", "utf8"))
  : {}
// A prize or an offer: its building or item when the site has it, else its text in French
const eventPrize = (text: string): EventPrize => {
  const link = prizeLinks.get(nameKey(text))
  return link ? { text: { en: text, fr: text }, link } : { text: translate(text) }
}
const eventCards: EventCard[] = []
const eventFiles = new Set<string>()
for (const file of existsSync(EVENTS) ? readdirSync(EVENTS) : []) {
  const event: GameEvent = JSON.parse(readFileSync(`${EVENTS}/${file}`, "utf8"))
  const live = eventLive[event.id] ? { start: eventLive[event.id] } : undefined
  const page: EventPage = {
    ...event,
    ...(live && { live }),
    quests: {
      main: event.quests.main.map(translateQuest),
      daily: event.quests.daily.map(translateQuest),
      rival: event.quests.rival.map((step) =>
        "milestone" in step ? { milestone: translate(step.milestone) } : translateQuest(step),
      ),
    },
    prizes: {
      lanes: event.prizes.lanes.map(translate),
      steps: event.prizes.steps.map(({ at, prizes }) => ({
        at,
        // A linked prize shows its building or item's own names
        prizes: prizes.map(eventPrize),
      })),
    },
    shops: (event.shops ?? []).map((shop) => ({
      name: translate(shop.name),
      offers: shop.offers.map((offer) => ({
        item: eventPrize(offer.item),
        price: offer.price,
        currency: translate(offer.currency),
      })),
    })),
    // Each tier lists the boxes of the tiers below and their content: the content is kept
    leagues: (event.leagues ?? []).map((league) => ({
      name: translate(league.name),
      top: league.top,
      rewards: league.rewards
        .filter((reward) => !/League Reward$/i.test(reward.item))
        .map((reward) => ({ count: reward.count, item: eventPrize(reward.item) })),
    })),
    ...(eventGuides[event.id] && { guide: eventGuides[event.id] }),
  }
  // Pictured by its first building prize
  const image = page.prizes.steps
    .flatMap((step) => step.prizes)
    .find((p) => p.link?.kind === "building" && p.link.image)?.link?.image
  const { id, name, family, year, beta } = event
  eventCards.push({ id, name, family, year, beta, ...(live && { live }), ...(image && { image }) })
  writeFileSync(`${EVENTS_OUTPUT}/${event.id}.json`, JSON.stringify(page))
  eventFiles.add(`${event.id}.json`)
}
for (const file of readdirSync(EVENTS_OUTPUT))
  if (!eventFiles.has(file)) rmSync(`${EVENTS_OUTPUT}/${file}`)
eventCards.sort((a, b) => (b.beta?.start ?? "").localeCompare(a.beta?.start ?? ""))
writeFileSync(`${OUTPUT}/events.json`, JSON.stringify(eventCards))
if (untranslated.size) {
  console.log(`Event texts with no French yet (data/event-texts.json, ${untranslated.size}):`)
  for (const key of untranslated) console.log(`  ${key}`)
}

console.log(`${buildings.length} buildings bundled into ${ages.length} ages (${OUTPUT})`)
