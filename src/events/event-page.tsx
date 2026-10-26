import { useState } from "react"
import { Link, getRouteApi } from "@tanstack/react-router"
import { ArrowLeft, ExternalLink } from "lucide-react"
import type { EventPage, EventPageRivalStep, EventPrize } from "@/core/event"
import { localized, useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { eventDate, eventTitle } from "./format"

const route = getRouteApi("/events/$id")

const backClass =
  "inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
const cellClass = "border-b px-3 py-2 align-top"
const headClass = "border-b px-3 py-2 text-left font-medium"

type Tab = "main" | "daily" | "rival" | "prizes"

// One event: its quests, its rival quests (when it has some) and its prize lane
export function EventPage() {
  const { t, locale } = useI18n()
  const { event } = route.useLoaderData()
  const tabs: Tab[] = [
    "main",
    "daily",
    ...(event.quests.rival.length ? (["rival"] as const) : []),
    "prizes",
  ]
  const [tab, setTab] = useState<Tab>("main")
  const site = new URL(event.source).hostname

  return (
    <div className="flex flex-col gap-6">
      <Link to="/events" className={backClass}>
        <ArrowLeft className="size-4" />
        {t.events.back}
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{eventTitle(event, locale)}</h1>
        {event.beta && (
          <p className="text-muted-foreground">
            {t.events.beta
              .replace("{start}", eventDate(event.beta.start, locale))
              .replace("{end}", eventDate(event.beta.end, locale))}
          </p>
        )}
        <a
          href={event.source}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t.events.source.replace("{site}", site)}
          <ExternalLink className="size-3.5" />
        </a>
      </header>

      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              tab === value
                ? "border-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.events[value]}
            {value !== "prizes" && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {questCount(value === "rival" ? event.quests.rival : event.quests[value])}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "main" && <QuestTable quests={event.quests.main} />}
      {tab === "daily" && <QuestTable quests={event.quests.daily} />}
      {tab === "rival" && <QuestTable quests={event.quests.rival} />}
      {tab === "prizes" && <PrizeTable lanes={event.prizes.lanes} steps={event.prizes.steps} />}
    </div>
  )
}

const questCount = (steps: EventPageRivalStep[]) => steps.filter((s) => "n" in s).length

function QuestTable({ quests }: { quests: EventPageRivalStep[] }) {
  const { t, locale } = useI18n()
  if (!quests.length) return <p className="text-muted-foreground">{t.events.none}</p>
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className={cn(headClass, "w-12")}>#</th>
            <th className={headClass}>{t.events.quest}</th>
            <th className={cn(headClass, "w-48")}>{t.events.reward}</th>
          </tr>
        </thead>
        <tbody>
          {quests.map((quest, k) =>
            "n" in quest ? (
              <tr key={k} className="last:[&>td]:border-0">
                <td className={cn(cellClass, "font-mono text-muted-foreground")}>{quest.n}</td>
                <td className={cellClass}>{localized(quest.text, locale)}</td>
                <td className={cellClass}>{localized(quest.reward, locale)}</td>
              </tr>
            ) : (
              <tr key={k} className="bg-primary/5 last:[&>td]:border-0">
                <td className={cellClass} />
                <td className={cn(cellClass, "font-medium")}>{t.events.milestone}</td>
                <td className={cn(cellClass, "font-medium")}>
                  {localized(quest.milestone, locale)}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

function PrizeTable({
  lanes,
  steps,
}: {
  lanes: EventPage["prizes"]["lanes"]
  steps: EventPage["prizes"]["steps"]
}) {
  const { t, locale } = useI18n()
  if (!steps.length) return <p className="text-muted-foreground">{t.events.none}</p>
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className={cn(headClass, "w-16")}>{t.events.step}</th>
            {lanes.map((lane) => (
              <th key={lane.en} className={headClass}>
                {localized(lane, locale)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <tr key={step.at} className="last:[&>td]:border-0">
              <td className={cn(cellClass, "font-mono text-muted-foreground")}>{step.at}</td>
              {step.prizes.map((prize, k) => (
                <td key={k} className={cellClass}>
                  <Prize prize={prize} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// A prize: its building or item (picture, name in the site's language, link to its page),
// else the source's text. Fragments keep their count ("50 ×")
function Prize({ prize }: { prize: EventPrize }) {
  const { locale } = useI18n()
  const { link } = prize
  if (!link) return <span>{localized(prize.text, locale)}</span>
  const fragments = prize.text.en.match(/^(\d+) Fragments of /i)?.[1]
  const name = localized(link.name, locale)
  const content = (
    <span className="flex items-center gap-2">
      {link.image && (
        <img src={link.image} alt="" loading="lazy" className="size-8 shrink-0 object-contain" />
      )}
      <span className="underline decoration-dotted underline-offset-4">
        {fragments ? `${fragments} × ${name}` : name}
      </span>
    </span>
  )
  return link.kind === "building" ? (
    <Link to="/buildings/$id" params={{ id: link.id }} className="hover:text-primary">
      {content}
    </Link>
  ) : (
    <Link to="/items/$id" params={{ id: link.id }} className="hover:text-primary">
      {content}
    </Link>
  )
}
