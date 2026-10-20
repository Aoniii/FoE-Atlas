import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { AgeIdSchema } from "@/core/building"
import { CompareView } from "@/compare/compare-page"
import { useI18n } from "@/lib/i18n"
import { fetchBuilding, fetchGreatBuilding, fetchIndex } from "@/wiki/data"

// /compare?kind=building&ids=a,b,c&age=IronAge  (or kind=great_building&level=40)
const searchSchema = z.object({
  kind: z.enum(["building", "great_building"]).optional().catch(undefined),
  ids: z.string().optional().catch(undefined),
  age: AgeIdSchema.optional().catch(undefined),
  level: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute("/compare")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ kind: search.kind ?? "building", ids: search.ids ?? "" }),
  loader: async ({ deps }) => {
    const ids = deps.ids.split(",").filter(Boolean).slice(0, 4)
    // A missing building just drops out of the comparison
    const settle = <T,>(promise: Promise<T>) => promise.catch(() => undefined)
    const index = await fetchIndex()
    if (deps.kind === "great_building") {
      const greatBuildings = await Promise.all(ids.map((id) => settle(fetchGreatBuilding(id))))
      return { index, buildings: [], greatBuildings: greatBuildings.filter((g) => g !== undefined) }
    }
    const buildings = await Promise.all(ids.map((id) => settle(fetchBuilding(id))))
    return { index, buildings: buildings.filter((b) => b !== undefined), greatBuildings: [] }
  },
  pendingComponent: Pending,
  component: CompareView,
})

function Pending() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-muted-foreground">{t.wiki.loading}</p>
}
