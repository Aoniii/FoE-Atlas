import { Check, Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { toggleCompare, useCompareSelection, type CompareItem } from "./selection"

// Adds the item to the comparison, or removes it; `iconOnly` for table rows and cards
export function CompareButton({
  item,
  iconOnly = false,
  className,
}: {
  item: CompareItem
  iconOnly?: boolean
  className?: string
}) {
  const { t } = useI18n()
  const selected = useCompareSelection().some((i) => i.kind === item.kind && i.id === item.id)
  const label = selected ? t.compare.remove : t.compare.add
  const Icon = selected ? Check : Scale
  return (
    <Button
      variant={selected ? "secondary" : iconOnly ? "ghost" : "outline"}
      size={iconOnly ? "icon-sm" : "sm"}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      className={cn(selected && "text-primary", className)}
      onClick={(event) => {
        // Inside links (cards): toggle without navigating
        event.preventDefault()
        event.stopPropagation()
        toggleCompare(item)
      }}
    >
      <Icon />
      {!iconOnly && t.compare.add}
    </Button>
  )
}
