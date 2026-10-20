import { z } from "zod"
import { AGE_IDS } from "./ages"
import { STAT_KEYS } from "./stats"

export const AgeIdSchema = z.enum(AGE_IDS)
export const StatKeySchema = z.enum(STAT_KEYS)

export const StatBlockSchema = z.partialRecord(StatKeySchema, z.number())

export const LocalizedSchema = z.object({ fr: z.string().min(1), en: z.string().min(1) })

// A single thing a building gives: a known stat, or an item (kit, fragments, unit...)
export const RewardSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stat"), stat: StatKeySchema, amount: z.number() }),
  z.object({
    type: z.literal("item"),
    id: z.string().min(1),
    name: LocalizedSchema,
    amount: z.number().positive(),
    icon: z.url().optional(),
  }),
])

export const RandomOptionSchema = z.object({
  chance: z.number().gt(0).max(100), // percent
  rewards: z.array(RewardSchema).min(1),
})

// One line of the 24h production: always given, or one random pick among options.
// `motivated`: only produced when the building is motivated.
export const OutputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("guaranteed"),
    motivated: z.boolean().optional(),
    rewards: z.array(RewardSchema).min(1),
  }),
  z.object({
    kind: z.literal("random"),
    motivated: z.boolean().optional(),
    options: z
      .array(RandomOptionSchema)
      .min(1)
      .refine((options) => options.reduce((sum, o) => sum + o.chance, 0) <= 100.0001, {
        message: "Random chances add up to more than 100%",
      }),
  }),
])

export const AgeDataSchema = z.object({
  // Values that are not produced: boosts (%), population, happiness...
  passive: StatBlockSchema,
  // Everything collected every 24h
  production: z.array(OutputSchema),
})

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
  // Slug of the English wiki title: unique, unlike image asset ids shared by levels
  id: z.string().min(1),
  name: LocalizedSchema,
  type: BuildingTypeSchema,
  image: z.url().optional(),
  // Event family id (see events.ts) and year, from the image asset id
  event: z.string().optional(),
  eventYear: z.number().int().optional(),
  // Upgrade chain (e.g. Terrace Farm Lv. 1 -> Lv. 2): every level is its own building
  chain: z.object({ id: z.string().min(1), level: z.number().int().positive() }).optional(),
  size: SizeSchema,
  road: RoadSchema,
  limitedDays: z.number().positive().optional(),
  reliability: ReliabilitySchema,
  sourceUrl: z.url().optional(),
  ages: z.partialRecord(AgeIdSchema, AgeDataSchema),
})

export type StatBlock = z.infer<typeof StatBlockSchema>
export type Reward = z.infer<typeof RewardSchema>
export type Output = z.infer<typeof OutputSchema>
export type AgeData = z.infer<typeof AgeDataSchema>
export type BuildingType = z.infer<typeof BuildingTypeSchema>
export type Road = z.infer<typeof RoadSchema>
export type Size = z.infer<typeof SizeSchema>
export type Building = z.infer<typeof BuildingSchema>
// A building as shipped to the site: one age only (see scripts/build-data.ts)
export type AgeBuilding = Omit<Building, "ages"> & { age: AgeData }
// A building as shipped to its own page: every age, plus the other levels of its chain
export type BuildingPage = Building & {
  chainLevels: { id: string; level: number; name: Building["name"] }[]
}
