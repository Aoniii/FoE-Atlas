import { useLayoutEffect } from "react"

export type EventTab = "prizes" | "shops" | "leagues"

// The event a page was opened from (a prize or a shop offer), carried from link to link
export type EventOrigin = { event?: string; eventTab?: EventTab }

const scrollKey = (event: string, tab: string) => `event.scroll.${event}.${tab}`

// Where the event page was scrolled when a prize or an offer was opened
export function rememberEventScroll(event: string, tab: string) {
  try {
    sessionStorage.setItem(scrollKey(event, tab), String(window.scrollY))
  } catch {
    // No storage: the way back lands at the top
  }
}

// Back on the event page: the place it was left at, once
export function useRestoredEventScroll(event: string, tab: string) {
  useLayoutEffect(() => {
    try {
      const saved = sessionStorage.getItem(scrollKey(event, tab))
      if (saved === null) return
      sessionStorage.removeItem(scrollKey(event, tab))
      window.scrollTo(0, Number(saved))
    } catch {
      // No storage
    }
  }, [event, tab])
}
