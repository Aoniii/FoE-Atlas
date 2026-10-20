import { z } from "zod"
import { AgeIdSchema, LocalizedSchema, RoadSchema, SizeSchema } from "./building"

// Great Buildings: one page per building, stats per level (not per age)
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
  // Level table as on the wiki: one column per bonus, raw values ("1,100", "12%")
  levels: z.object({
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
  }),
  sourceUrl: z.url().optional(),
})

export type GreatBuilding = z.infer<typeof GreatBuildingSchema>

// Light entry of the Great Buildings grid
export type GreatBuildingCard = Pick<GreatBuilding, "id" | "name" | "image" | "age">
