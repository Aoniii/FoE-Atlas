import { createFileRoute } from "@tanstack/react-router"
import { useI18n } from "@/lib/i18n"
import { EventsPage } from "@/events/events-page"
import { fetchEvents } from "@/wiki/data"

export const Route = createFileRoute("/events/")({
  loader: () => fetchEvents().catch(() => []),
  pendingComponent: Pending,
  component: EventsPage,
})

function Pending() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-muted-foreground">{t.events.loading}</p>
}
