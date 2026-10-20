import { useContext } from "react"
import type { StatKey } from "@/core/stats"
import { cn } from "@/lib/utils"
import { StatIconsContext } from "./stat-icons-context"

// Small game icon of a stat (nothing when the stat has none)
export function StatIcon({ stat, className }: { stat: StatKey; className?: string }) {
  const url = useContext(StatIconsContext)[stat]
  if (!url) return null
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className={cn("inline-block size-4 shrink-0 object-contain align-text-bottom", className)}
    />
  )
}
