// Events from foebeta.com, which covers each one as it runs on the beta server, weeks
// before the live servers: main and daily quests, rival quests, prize lane. One request per
// article, a second apart; pages are kept in scripts/.cache/events/ ("--offline" re-reads
// them). Writes data/events/<id>.json; French texts: data/event-texts.json.
//   pnpm events [--offline] [article URL ...]   (default: the events already in data/events,
//   articles listed on https://foebeta.com/events/)

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import type { EventQuest, GameEvent, RivalStep } from "../src/core/event"
import { EVENTS } from "../src/core/events"

const CACHE = "scripts/.cache/events"
const AGENT = "FoE-Atlas/1.0 (+https://github.com/Aoniii/FoE-Atlas)"

const entities: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
}
const decode = (text: string) =>
  text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/g, (whole, name) => entities[name] ?? whole)

// A cell's text, an icon standing for its title ("reward icon halloween ticket": "halloween
// ticket")
function cellText(html: string): string {
  const withIcons = html.replace(
    /<img[^>]*?(?:title|alt)="([^"]*)"[^>]*>/g,
    (_, title: string) => ` ${title.replace(/^reward[ _]icon[ _]/i, "").replace(/[-_]/g, " ")} `,
  )
  return decode(withIcons.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim()
}

// Rows of every table of the article, cells as text, with the section (h2) it is under
function tables(html: string): { section: string; rows: string[][] }[] {
  let section = ""
  const found: { section: string; rows: string[][] }[] = []
  for (const [part, heading] of html.matchAll(
    /<h2[^>]*>([\s\S]*?)<\/h2>|<table[\s\S]*?<\/table>/g,
  )) {
    if (heading !== undefined) {
      section = cellText(heading)
      continue
    }
    const rows = [...part.matchAll(/<tr[\s\S]*?<\/tr>/g)].map(([row]) =>
      [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(([, cell]) => cellText(cell)),
    )
    found.push({ section, rows })
  }
  return found
}

// "6 icon quest halloween event token common 883867b29" -> 6 and the currency's icon name
function price(cell: string) {
  const amount = Number(cell.match(/^[\d,]+/)?.[0].replace(/,/g, ""))
  const currency = cell
    .replace(/^[\d,]+\s*/, "")
    .replace(/^icon quest /, "")
    .replace(/\s+[0-9a-f]{9}$/, "")
    .trim()
  return { amount, currency }
}

const MONTHS =
  "January February March April May June July August September October November December".split(" ")
const isoDate = (text: string) => {
  const m = text.match(/([A-Z][a-z]+) (\d{1,2}), (\d{4})/)
  if (!m || !MONTHS.includes(m[1])) return undefined
  return `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`
}

// "12", or a quest with a choice of branches: "1a", "1b"
const QUEST_NUMBER = /^\d+[a-z]?$/

const questRows = (rows: string[][]): EventQuest[] =>
  rows.flatMap(([n, text, reward]) =>
    QUEST_NUMBER.test(n ?? "") && text ? [{ n, text, reward: reward ?? "" }] : [],
  )

export function parseEvent(html: string, url: string): GameEvent | undefined {
  const article = html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? html
  const title = cellText(article.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "")
  // "Fall Event 2026: Missions, Rival, and Store" -> "Fall Event 2026"
  const name = title.replace(/\s*[:|–-].*$/, "")
  if (!name) return undefined
  const text = cellText(article)
  const span = text.match(
    /begins on ([A-Z][a-z]+ \d{1,2}, \d{4})[^.]*?ending on ([A-Z][a-z]+ \d{1,2}, \d{4})/,
  )
  const start = span && isoDate(span[1])
  const end = span && isoDate(span[2])
  // "Halloween Event 2026": the family whose English name it starts with, and the year
  const family = Object.entries(EVENTS).find(([, n]) =>
    name.toLowerCase().startsWith(n.en.toLowerCase()),
  )?.[0]
  const year = Number(name.match(/\b(20\d\d)\b/)?.[1]) || undefined
  const event: GameEvent = {
    id: url
      .replace(/\/$/, "")
      .split("/")
      .at(-1)!
      .replace(/-missions.*$/, ""),
    name,
    ...(family && { family }),
    ...(year && { year }),
    source: url,
    ...(start && end && { beta: { start, end } }),
    quests: { main: [], daily: [], rival: [] },
    prizes: { lanes: [], steps: [] },
  }
  for (const { section, rows } of tables(article)) {
    const head = (rows[0] ?? []).join(" ")
    if (/Rush Quest/i.test(head)) event.quests.main.push(...questRows(rows))
    else if (/Daily Quest/i.test(head)) event.quests.daily.push(...questRows(rows))
    else if (/^\s*Rival\b/i.test(rows[0]?.[0] ?? "")) {
      for (const [n, text, reward] of rows.slice(1)) {
        if (QUEST_NUMBER.test(n ?? "")) event.quests.rival.push({ n, text, reward: reward ?? "" })
        else if (/milestone/i.test(text ?? ""))
          event.quests.rival.push({ milestone: reward ?? "" } satisfies RivalStep)
      }
    } else if (/^Offer\b/i.test(rows[0]?.[0] ?? "")) {
      // A shop: its offers and their price, under its title ("Clown's Counter")
      const offers = rows.slice(1).flatMap(([item, cell]) => {
        const { amount, currency } = price(cell ?? "")
        return item && amount ? [{ item, price: amount, currency }] : []
      })
      if (offers.length) (event.shops ??= []).push({ name: section, offers })
    } else if (/Prize Lane/i.test(head) && !event.prizes.steps.length) {
      // A title row ("Grand Prize Lane"), then "#" and the lanes, then a row per step
      const header = rows.findIndex((row) => row[0] === "#")
      if (header < 0) continue
      event.prizes.lanes = rows[header].slice(1)
      for (const [at, ...prizes] of rows.slice(header + 1)) {
        if (/^\d+$/.test(at ?? "")) event.prizes.steps.push({ at, prizes })
      }
    }
  }
  return event
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "User-Agent": AGENT } })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.text()
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))

async function main() {
  const offline = process.argv.includes("--offline")
  const asked = process.argv.slice(2).filter((a) => a.startsWith("http"))
  mkdirSync(CACHE, { recursive: true })
  mkdirSync("data/events", { recursive: true })
  const cached = (url: string) => `${CACHE}/${url.replace(/\/$/, "").split("/").at(-1)}.html`
  const urls = asked.length
    ? asked
    : readdirSync("data/events").map(
        (file) => (JSON.parse(readFileSync(`data/events/${file}`, "utf8")) as GameEvent).source,
      )
  for (const url of urls) {
    const file = cached(url)
    let html: string
    if (offline && existsSync(file)) html = readFileSync(file, "utf8")
    else {
      await wait(1000)
      html = await fetchText(url)
      writeFileSync(file, html)
    }
    const event = parseEvent(html, url)
    if (!event) {
      console.log(`${url}: no event found`)
      continue
    }
    writeFileSync(`data/events/${event.id}.json`, JSON.stringify(event, null, 2) + "\n")
    const { main: m, daily, rival } = event.quests
    console.log(
      `${event.name}: ${m.length} main, ${daily.length} daily, ${rival.length} rival, ${event.prizes.steps.length} prize steps`,
    )
  }
}

if (process.argv[1]?.endsWith("events.ts")) main()
