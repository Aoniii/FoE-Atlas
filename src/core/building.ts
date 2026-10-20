import { z } from "zod"
import { AGE_IDS } from "./ages"
import { STAT_KEYS } from "./stats"

export const AgeIdSchema = z.enum(AGE_IDS)
export const StatKeySchema = z.enum(STAT_KEYS)

export const StatBlockSchema = z.partialRecord(StatKeySchema, z.number())

export const BuildingTypeSchema = z.enum([
  "special",
  "great_building",
  "production",
  "residential",
  "goods",
  "military",
  "cultural",
  "decoration",
])

export const RoadSchema = z.enum(["none", "road", "two_lane"])

export const ReliabilitySchema = z.enum(["official", "wiki", "estimated"])

export const SizeSchema = z.object({
  w: z.number().int().positive(),
  h: z.number().int().positive(),
})

export const BuildingSchema = z.object({
  id: z.string().min(1),
  name: z.object({ fr: z.string().min(1), en: z.string().min(1) }),
  type: BuildingTypeSchema,
  event: z.string().optional(),
  // Upgrade chain (e.g. Terrace Farm Lv. 1 -> Lv. 2): every level is its own building
  chain: z.object({ id: z.string().min(1), level: z.number().int().positive() }).optional(),
  size: SizeSchema,
  road: RoadSchema,
  limitedDays: z.number().positive().optional(),
  reliability: ReliabilitySchema,
  sourceUrl: z.url().optional(),
  stats: z.partialRecord(AgeIdSchema, StatBlockSchema),
})

export type StatBlock = z.infer<typeof StatBlockSchema>
export type BuildingType = z.infer<typeof BuildingTypeSchema>
export type Road = z.infer<typeof RoadSchema>
export type Size = z.infer<typeof SizeSchema>
export type Building = z.infer<typeof BuildingSchema>
