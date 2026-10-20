import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { LATEST_AGE } from "@/core/ages"
import { AgeIdSchema, BuildingTypeSchema } from "@/core/building"
import { getPreferredAge } from "@/lib/age-preference"
import { useI18n } from "@/lib/i18n"
import { fetchAgeBuildings, fetchIndex } from "@/wiki/data"
import { WikiPage } from "@/wiki/wiki-page"

// Filters live in the URL (shareable, survive a reload); invalid values are dropped
const searchSchema = z.object({
  age: AgeIdSchema.optional().catch(undefined),
  type: BuildingTypeSchema.optional().catch(undefined),
  event: z.string().optional().catch(undefined),
})

export const Route = createFileRoute("/wiki")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ age: search.age ?? getPreferredAge() ?? LATEST_AGE }),
  loader: async ({ deps }) => {
    const [index, buildings] = await Promise.all([fetchIndex(), fetchAgeBuildings(deps.age)])
    return { index, buildings }
  },
  pendingComponent: Pending,
  errorComponent: LoadError,
  component: WikiPage,
})

function Pending() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-muted-foreground">{t.wiki.loading}</p>
}

function LoadError() {
  const { t } = useI18n()
  return <p className="py-10 text-center text-destructive">{t.wiki.error}</p>
}
