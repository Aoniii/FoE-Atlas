import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useI18n } from "@/lib/i18n"

const backClass =
  "inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"

// Back to the event a prize or an offer was opened from, on its tab
export function BackToEvent({
  event,
  tab = "prizes",
}: {
  event: string
  tab?: "prizes" | "shops"
}) {
  const { t } = useI18n()
  return (
    <Link to="/events/$id" params={{ id: event }} search={{ tab }} className={backClass}>
      <ArrowLeft className="size-4" />
      {t.events.backToEvent}
    </Link>
  )
}
