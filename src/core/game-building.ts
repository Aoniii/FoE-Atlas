// A building as defined by the game itself (data/game-buildings.json, see
// scripts/game-data.ts): values per age, and how it links to other buildings.

import { z } from "zod"
import type { AgeId } from "./ages"
import type { AgeData, BuildingType, Road, Size } from "./building"

// Area, relative to a building's top-left tile, where the next link of its chain sits
export const LinkRegionSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
})
export type LinkRegion = z.infer<typeof LinkRegionSchema>

// Chain (Panda Sanctuary + Lotus Lakes): links attach one after the other from the start,
// each adding its bonus to the start building. Set: each building gets one bonus per
// adjacent building of the same set (1, 2...). Bonuses per age, in AgeData form.
export type GameLinks = {
  chain?: {
    id: string
    role: "start" | "link"
    next?: LinkRegion
    bonus?: Partial<Record<AgeId, AgeData>>
  }
  set?: { id: string; bonuses?: Partial<Record<AgeId, AgeData[]>> }
}

export type GameBuilding = {
  gameId: string
  assetId: string
  // In the language of the server the export comes from
  name: string
  type: BuildingType
  size: Size
  road: Road
  ages: Partial<Record<AgeId, AgeData>>
  links?: GameLinks
}
