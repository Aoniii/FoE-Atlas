import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { ALLY_RARITIES } from "@/core/ally"
import { useI18n } from "@/lib/i18n"
import { AllyPage } from "@/wiki/ally-page"
import { DataNotFoundError, fetchAlly } from "@/wiki/data"

export const Route = createFileRoute("/allies/$id")({
  validateSearch: z.object({
    rarity: z.enum(ALLY_RARITIES).optional().catch(undefined),
    level: z.coerce.number().int().positive().optional().catch(undefined),
    // Event the page was opened from (its prizes), for the back link
    event: z.string().optional().catch(undefined),
    eventTab: z.enum(["prizes", "shops", "leagues"]).optional().catch(undefined),
  }),
  loader: async ({ params }) => {
    try {
      return { ally: await fetchAlly(params.id) }
    } catch (error) {
      if (error instanceof DataNotFoundError) throw notFound()
      throw error
    }
  },
  pendingComponent: Pending,
  notFoundComponent: NotFound,
  component: AllyPage,
})

function Pending() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-muted-foreground">{t.ally.loading}</p>
}

function NotFound() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-muted-foreground">{t.ally.notFound}</p>
}
