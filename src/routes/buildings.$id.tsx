import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { AgeIdSchema } from "@/core/building"
import { useI18n } from "@/lib/i18n"
import { BuildingPage } from "@/wiki/building-page"
import { DataNotFoundError, fetchBuilding, fetchIndex } from "@/wiki/data"

export const Route = createFileRoute("/buildings/$id")({
  validateSearch: z.object({ age: AgeIdSchema.optional().catch(undefined) }),
  loader: async ({ params }) => {
    try {
      const [building, index] = await Promise.all([fetchBuilding(params.id), fetchIndex()])
      return { building, icons: index.icons ?? {} }
    } catch (error) {
      if (error instanceof DataNotFoundError) throw notFound()
      throw error
    }
  },
  pendingComponent: Pending,
  notFoundComponent: NotFound,
  component: BuildingPage,
})

function Pending() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-muted-foreground">{t.building.loading}</p>
}

function NotFound() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-muted-foreground">{t.building.notFound}</p>
}
