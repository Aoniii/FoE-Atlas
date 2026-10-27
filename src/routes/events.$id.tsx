import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { useI18n } from "@/lib/i18n"
import { EventPage } from "@/events/event-page"
import { DataNotFoundError, fetchEvent } from "@/wiki/data"

export const Route = createFileRoute("/events/$id")({
  // Open tab, kept in the URL so the way back from a prize lands on it
  validateSearch: z.object({
    tab: z
      .enum(["guide", "main", "daily", "rival", "prizes", "shops", "leagues"])
      .optional()
      .catch(undefined),
  }),
  loader: async ({ params }) => {
    try {
      return { event: await fetchEvent(params.id) }
    } catch (error) {
      if (error instanceof DataNotFoundError) throw notFound()
      throw error
    }
  },
  pendingComponent: Pending,
  notFoundComponent: NotFound,
  component: EventPage,
})

function Pending() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-muted-foreground">{t.events.loading}</p>
}

function NotFound() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-muted-foreground">{t.events.notFound}</p>
}
