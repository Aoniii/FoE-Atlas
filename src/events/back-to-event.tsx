import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useI18n } from "@/lib/i18n"

const backClass =
  "inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"

// Back to the event a prize was opened from, on its prize tab
export function BackToEvent({ event }: { event: string }) {
  const { t } = useI18n()
  return (
    <Link to="/events/$id" params={{ id: event }} search={{ tab: "prizes" }} className={backClass}>
      <ArrowLeft className="size-4" />
      {t.events.backToEvent}
    </Link>
  )
}
