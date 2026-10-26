import { useLayoutEffect } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useI18n } from "@/lib/i18n"

const backClass =
  "inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"

export type EventTab = "prizes" | "shops"

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

// Back to the event a prize or an offer was opened from, on its tab
export function BackToEvent({ event, tab = "prizes" }: { event: string; tab?: EventTab }) {
  const { t } = useI18n()
  return (
    // The event page puts itself back where it was left (useRestoredEventScroll)
    <Link
      to="/events/$id"
      params={{ id: event }}
      search={{ tab }}
      resetScroll={false}
      className={backClass}
    >
      <ArrowLeft className="size-4" />
      {t.events.backToEvent}
    </Link>
  )
}
