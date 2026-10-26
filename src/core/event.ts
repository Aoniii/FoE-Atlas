// Events of the game as the beta server shows them first (data/events/<id>.json, see
// scripts/events.ts): quests, rival quests, prize lanes, and how the site shows them.

import type { LocalizedName } from "./game-item"

// A quest: its number in its line ("12", or "1a" and "1b" for a choice of branches), what to
// do, what it gives (as written by the source)
export type EventQuest = { n: string; text: string; reward: string }

// A rival quest line can hold milestone rewards between quests
export type RivalStep = EventQuest | { milestone: string }

export type GameEvent = {
  id: string
  // As the source writes it ("Halloween Event 2026"), and its family and year when known
  // (the site's own names: src/core/events.ts)
  name: string
  family?: string
  year?: number
  // The article it comes from
  source: string
  // When it ran on the beta server (ISO dates), when the article says so
  beta?: { start: string; end: string }
  quests: { main: EventQuest[]; daily: EventQuest[]; rival: RivalStep[] }
  // Prize lane: its columns (free lane, passes...) and, at each step, a prize per column
  prizes: { lanes: string[]; steps: { at: string; prizes: string[] }[] }
}

// A prize as the site shows it: its text (in French too, scripts/event-texts.ts), and the
// building or item it is, when known
export type EventPrize = {
  text: LocalizedName
  link?: { kind: "building" | "item"; id: string; name: LocalizedName; image?: string }
}

// Event grid (public/data/events.json)
export type EventCard = Pick<GameEvent, "id" | "name" | "family" | "year" | "beta"> & {
  image?: string
}

// A quest as the site shows it: its texts in English and French
export type EventPageQuest = { n: string; text: LocalizedName; reward: LocalizedName }
export type EventPageRivalStep = EventPageQuest | { milestone: LocalizedName }

// One event (public/data/events/<id>.json): texts translated, prizes linked to the site's pages
export type EventPage = Omit<GameEvent, "quests" | "prizes"> & {
  quests: { main: EventPageQuest[]; daily: EventPageQuest[]; rival: EventPageRivalStep[] }
  prizes: { lanes: LocalizedName[]; steps: { at: string; prizes: EventPrize[] }[] }
}
