// French for the English texts of events (data/event-texts.json). A quest is cut into its
// parts ("Spend some Forge Points AND Gather some supplies"), each part looked up with its
// numbers as {0}, {1}... ("build {0} decorations"), so one entry serves every event.

import type { LocalizedName } from "../src/core/game-item"

const NUMBER = /\d+(?:[.,]\d+)?/g
const JOINS: Record<string, string> = { AND: "ET", OR: "OU" }

// "Build 7 decorations" -> "build {0} decorations", and its numbers
function template(text: string): { key: string; numbers: string[] } {
  const numbers: string[] = []
  const key = text
    .replace(NUMBER, (n) => `{${numbers.push(n) - 1}}`)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
  return { key, numbers }
}

export function eventTranslator(dictionary: Record<string, string>) {
  const fr = new Map(Object.entries(dictionary).map(([k, v]) => [k.toLowerCase(), v]))
  // Texts with no entry yet, as templates (to add to the dictionary)
  const missing = new Set<string>()
  const part = (text: string) => {
    const { key, numbers } = template(text)
    const found = fr.get(key)
    if (found === undefined) {
      missing.add(key)
      return text
    }
    return found.replace(/\{(\d+)\}/g, (_, i) => numbers[Number(i)] ?? "")
  }
  // A text as a whole (a reward, a prize), else cut at its AND / OR (a quest)
  const translate = (text: string): LocalizedName => {
    if (!text) return { en: text, fr: text }
    if (fr.has(template(text).key)) return { en: text, fr: part(text) }
    const pieces = text.split(/ (AND|OR) /)
    return {
      en: text,
      fr: pieces.map((piece, i) => (i % 2 ? JOINS[piece] : part(piece))).join(" "),
    }
  }
  return { translate, missing }
}
