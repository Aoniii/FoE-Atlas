import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { formatNumber, scoreColor } from "./format"

// Score in a rainbow-colored pill with readable text (wiki table, chain levels)
export function ScorePill({ score, className }: { score: number; className?: string }) {
  const { locale } = useI18n()
  const { background, foreground } = scoreColor(score)
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-center text-xs font-semibold",
        className,
      )}
      style={{ backgroundColor: background, color: foreground }}
    >
      {formatNumber(score, locale, 2)}
    </span>
  )
}
