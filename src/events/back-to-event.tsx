import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import type { EventTab } from "./event-origin"

const backClass =
  "inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"

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
