import { cn } from "@/lib/utils"
import { flags, type Locale } from "@/lib/i18n"

// SVG files instead of emoji flags: emoji flags do not render on Windows
export function Flag({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <img
      src={flags[locale]}
      alt=""
      className={cn(
        "h-3.5 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-foreground/10",
        className,
      )}
    />
  )
}
