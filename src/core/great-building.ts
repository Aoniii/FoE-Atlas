import { z } from "zod"
import { AgeIdSchema, LocalizedSchema, RoadSchema, SizeSchema } from "./building"
import { PrestigeSchema, type PrestigeTier } from "./gb-prestige"

// Great Buildings: one page per building, stats per level (not per age). Names, picture,
// description and copper bonus texts from the wiki; values from the game (prestige)
export const GreatBuildingSchema = z.object({
  id: z.string().min(1),
  name: LocalizedSchema,
  image: z.url(),
  // Age the building belongs to; undefined for the few available in every age
  age: AgeIdSchema.optional(),
  size: SizeSchema,
  road: RoadSchema,
  description: z.object({ fr: z.string(), en: z.string() }),
  boosts: z.array(
    z.object({
      icon: z.url().optional(),
      name: LocalizedSchema,
      text: z.object({ fr: z.string(), en: z.string() }),
    }),
  ),
  // Level table of the wiki, from before the prestige rework: kept in data/great-buildings,
  // left out of the site
  levels: z
    .object({
      columns: z.array(
        z.object({ icon: z.url().optional(), label: z.object({ fr: z.string(), en: z.string() }) }),
      ),
      rows: z.array(
        z.object({
          level: z.number().int().positive(),
          cost: z.number().optional(),
          values: z.array(z.string()),
        }),
      ),
    })
    .optional(),
  sourceUrl: z.url().optional(),
  // Bonuses, costs and levels since the prestige rework (set by build-data)
  prestige: PrestigeSchema.optional(),
})

export type GreatBuilding = z.infer<typeof GreatBuildingSchema>

// Highest level of a Gold Great Building
export const GB_MAX_LEVEL = 500

// Light entry of the Great Buildings grid
export type GreatBuildingCard = Pick<GreatBuilding, "id" | "name" | "image" | "age"> & {
  // Highest tier: copper (up to level 200) or gold (up to 500)
  tier?: PrestigeTier
}
