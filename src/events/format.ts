import type { EventCard } from "@/core/event"
import type { Locale } from "@/lib/i18n"
import { eventName } from "@/wiki/format"

// "Événement Halloween 2026": the site's name of its family, else the source's name
export function eventTitle(event: Pick<EventCard, "name" | "family" | "year">, locale: Locale) {
  if (!event.family) return event.name
  return `${eventName(event.family, locale)}${event.year ? ` ${event.year}` : ""}`
}

// "28 septembre 2026"
export const eventDate = (iso: string, locale: Locale) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { dateStyle: "long" })

// "30 octobre 2026 à 10:30", in the player's time zone
export const eventTime = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleString(locale, { dateStyle: "long", timeStyle: "short" })

// Day of the n-th daily quest from the live start: "ven. 30 oct."
export function questDay(start: string, n: number, locale: Locale) {
  const day = new Date(start)
  day.setDate(day.getDate() + n - 1)
  return day.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })
}
