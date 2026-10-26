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
