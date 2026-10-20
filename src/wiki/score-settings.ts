import { statsOfGroup, type StatKey } from "@/core/stats"
import { usePersistentState } from "@/lib/use-persistent-state"

// FP, goods of the 3 ages, guild goods and every army boost (both armies, all contexts)
export const DEFAULT_SCORE: StatKey[] = [
  "fp",
  "goods_prev",
  "goods",
  "goods_next",
  "guild_goods",
  ...statsOfGroup("attacking_army"),
  ...statsOfGroup("defending_army"),
]

// Stats counted in the score, chosen on the wiki and saved in the browser:
// shared by the wiki table and the building pages
export function useScoreKeys() {
  return usePersistentState("wiki.score.v3", DEFAULT_SCORE)
}
