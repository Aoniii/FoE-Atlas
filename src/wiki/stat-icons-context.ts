import { createContext } from "react"
import type { StatKey } from "@/core/stats"

// Stat -> icon URL, provided by the wiki page from the loaded data index
export const StatIconsContext = createContext<Partial<Record<StatKey, string>>>({})
