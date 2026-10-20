import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { useI18n } from "@/lib/i18n"
import { DataNotFoundError, fetchGbRewards, fetchGreatBuilding } from "@/wiki/data"
import { GreatBuildingPage } from "@/wiki/great-building-page"

export const Route = createFileRoute("/great-buildings/$id")({
  validateSearch: z.object({
    level: z.coerce.number().int().positive().optional().catch(undefined),
  }),
  loader: async ({ params }) => {
    try {
      const [greatBuilding, rewards] = await Promise.all([
        fetchGreatBuilding(params.id),
        fetchGbRewards().catch(() => undefined),
      ])
      return { greatBuilding, rewards }
    } catch (error) {
      if (error instanceof DataNotFoundError) throw notFound()
      throw error
    }
  },
  pendingComponent: Pending,
  notFoundComponent: NotFound,
  component: GreatBuildingPage,
})

function Pending() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-muted-foreground">{t.greatBuilding.loading}</p>
}

function NotFound() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-muted-foreground">{t.greatBuilding.notFound}</p>
}
