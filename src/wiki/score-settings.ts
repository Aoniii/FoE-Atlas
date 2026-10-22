import { useSyncExternalStore } from "react"
import { DEFAULT_BOOST_BASES, type BoostBases } from "@/core/efficiency"
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

// Daily production the percent boosts apply to, typed in the score settings or computed from
// the imported city. One store for the whole page: every component sees a change at once.
const BASES_KEY = "score.bases"
const listeners = new Set<() => void>()
let bases: BoostBases = readBases()

function readBases(): BoostBases {
  try {
    const stored = localStorage.getItem(BASES_KEY)
    return stored ? { ...DEFAULT_BOOST_BASES, ...JSON.parse(stored) } : DEFAULT_BOOST_BASES
  } catch {
    return DEFAULT_BOOST_BASES
  }
}

export function setBoostBases(next: Partial<BoostBases>) {
  const merged = { ...bases, ...next }
  if (Object.entries(merged).every(([key, value]) => bases[key as keyof BoostBases] === value)) {
    return
  }
  bases = merged
  try {
    localStorage.setItem(BASES_KEY, JSON.stringify(bases))
  } catch {
    // Storage unavailable: keep the in-memory value
  }
  for (const listener of listeners) listener()
}

export function useBoostBases(): BoostBases {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => bases,
  )
}
