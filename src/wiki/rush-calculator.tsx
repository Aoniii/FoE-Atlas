import { useMemo, useState } from "react"
import { COPPER_MAX_LEVEL, type Prestige } from "@/core/gb-prestige"
import { rushPlan, type RushLevel } from "@/core/rush"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/lib/i18n"
import { usePersistentState } from "@/lib/use-persistent-state"
import { cn } from "@/lib/utils"
import { formatNumber } from "./format"

// A place: given away or kept, at the arc bonus of copper levels and of Gold levels
type Place = { open: boolean; arc: number; arcGold: number }

// The player's arc bonuses rarely change: remembered for every Great Building
const DEFAULT_PLACES: Place[] = Array.from({ length: 7 }, () => ({
  open: true,
  arc: 90,
  arcGold: 0,
}))

// Rush calculator: levels from..to, the places given away at their arc bonus (five on
// copper levels, seven on the Gold levels of a Gold building)
export function RushCalculator({ prestige, name }: { prestige: Prestige; name: string }) {
  const { t, locale } = useI18n()
  const [places, setPlaces] = usePersistentState("rush.places.v2", DEFAULT_PLACES)
  const [from, setFrom] = useState(0)
  const [to, setTo] = useState(10)
  const gold = prestige.maxLevel > COPPER_MAX_LEVEL
  const shown = places.slice(0, gold ? 7 : 5)

  const plan = useMemo(
    () =>
      rushPlan({
        prestige,
        from,
        to,
        copper: places.map((place) => (place.open ? place.arc : null)),
        gold: places.map((place) => (place.open ? place.arcGold : null)),
      }),
    [prestige, from, to, places],
  )
  const setPlace = (index: number, change: Partial<Place>) =>
    setPlaces((list) => list.map((place, i) => (i === index ? { ...place, ...change } : place)))
  const level = (value: string, fallback: number) => {
    const number = Math.trunc(Number(value))
    return Number.isFinite(number) ? Math.min(Math.max(number, 0), prestige.maxLevel) : fallback
  }
  const fp = (value: number) => formatNumber(value, locale)
  // "Alcatraz 10→11 : P1 120 · P2 60 · P3 20", the open places only, ready for the game's chat
  const line = (l: RushLevel) =>
    `${name} ${l.level - 1}→${l.level}${t.rush.colon}${l.places
      .flatMap((value, i) => (value ? [`P${i + 1} ${value}`] : []))
      .join(" · ")}`
  // Which copy just happened ("all" or a level), for a moment
  const [copied, setCopied] = useState<number | "all">()
  const copy = async (text: string, what: number | "all") => {
    if (!(await writeClipboard(text))) return
    setCopied(what)
    setTimeout(() => setCopied((current) => (current === what ? undefined : current)), 1500)
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">{t.rush.title}</h2>
        <p className="text-sm text-muted-foreground">{t.rush.intro}</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t.rush.from}
          <Input
            type="number"
            min={0}
            max={prestige.maxLevel}
            value={from}
            onChange={(event) => setFrom(level(event.target.value, from))}
            className="w-28"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t.rush.to}
          <Input
            type="number"
            min={1}
            max={prestige.maxLevel}
            value={to}
            onChange={(event) => setTo(level(event.target.value, to))}
            className="w-28"
          />
        </label>
      </div>

      <div
        className={cn(
          "grid grid-cols-2 gap-3",
          gold ? "sm:grid-cols-4 lg:grid-cols-7" : "sm:grid-cols-5",
        )}
      >
        {shown.map((place, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-md bg-muted/40 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={place.open}
                onCheckedChange={(checked) => setPlace(index, { open: checked })}
              />
              {t.rush.place.replace("{n}", String(index + 1))}
            </label>
            {/* Places 6 and 7 only exist on Gold levels */}
            {index < 5 && (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t.rush.arc}
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={place.arc}
                  disabled={!place.open}
                  onChange={(event) => setPlace(index, { arc: Number(event.target.value) || 0 })}
                />
              </label>
            )}
            {gold && (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t.rush.arcGold}
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={place.arcGold}
                  disabled={!place.open}
                  onChange={(event) =>
                    setPlace(index, { arcGold: Number(event.target.value) || 0 })
                  }
                />
              </label>
            )}
          </div>
        ))}
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Total label={t.rush.levelsCost} value={fp(plan.cost)} />
        <Total label={t.rush.patrons} value={fp(plan.patrons)} />
        <Total label={t.rush.own} value={fp(plan.own)} highlight />
      </dl>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>{t.rush.maxLevel.replace("{level}", String(prestige.maxLevel))}</p>
        <p>{t.rush.source}</p>
      </div>

      {plan.levels.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">{t.rush.detail}</summary>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => copy(plan.levels.map(line).join("\n"), "all")}
          >
            {copied === "all" ? <Check /> : <Copy />}
            {copied === "all" ? t.rush.copied : t.rush.copyAll}
          </Button>
          <div className="mt-2 max-h-96 overflow-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="bg-muted/40 text-muted-foreground">
                  <Th>{t.rush.level}</Th>
                  <Th>{t.rush.cost}</Th>
                  {shown.map((_, i) => (
                    <Th key={i}>{t.rush.place.replace("{n}", String(i + 1))}</Th>
                  ))}
                  <Th>{t.rush.own}</Th>
                  <Th>
                    <span className="sr-only">{t.rush.copy}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {plan.levels.map((l) => (
                  <tr key={l.level} className="border-b last:border-0">
                    <Td>{l.level}</Td>
                    <Td>{fp(l.cost)}</Td>
                    {shown.map((_, i) => (
                      <Td key={i} muted={!l.places[i]}>
                        {l.places[i] ? fp(l.places[i]) : "–"}
                      </Td>
                    ))}
                    <Td>
                      <span className="font-medium">{fp(l.own)}</span>
                    </Td>
                    <Td>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t.rush.copy}
                        aria-label={`${t.rush.copy} ${l.level}`}
                        onClick={() => copy(line(l), l.level)}
                      >
                        {copied === l.level ? <Check /> : <Copy />}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}

// Text to the clipboard: the Clipboard API, else a hidden text area copied the old way (the
// API refused or missing)
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement("textarea")
    area.value = text
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.append(area)
    area.select()
    const done = document.execCommand("copy")
    area.remove()
    return done
  }
}

function Total({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-md bg-muted/40 p-3", highlight && "ring-1 ring-primary")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-lg font-semibold", highlight && "text-primary")}>{value}</dd>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b px-3 py-2 text-right font-medium whitespace-nowrap">{children}</th>
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td
      className={cn("px-3 py-1.5 text-right whitespace-nowrap", muted && "text-muted-foreground")}
    >
      {children}
    </td>
  )
}
