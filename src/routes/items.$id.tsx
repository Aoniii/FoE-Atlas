import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { useI18n } from "@/lib/i18n"
import { DataNotFoundError, fetchItem } from "@/wiki/data"
import { ItemPage } from "@/wiki/item-page"

export const Route = createFileRoute("/items/$id")({
  validateSearch: z.object({
    // Event the page was opened from (its prizes), for the back link
    event: z.string().optional().catch(undefined),
    eventTab: z.enum(["prizes", "shops"]).optional().catch(undefined),
  }),
  loader: async ({ params }) => {
    try {
      return { item: await fetchItem(params.id) }
    } catch (error) {
      if (error instanceof DataNotFoundError) throw notFound()
      throw error
    }
  },
  pendingComponent: Pending,
  notFoundComponent: NotFound,
  component: ItemPage,
})

function Pending() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-muted-foreground">{t.item.loading}</p>
}

function NotFound() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-muted-foreground">{t.item.notFound}</p>
}
