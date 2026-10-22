import { Columns3, RotateCcw, SquareX } from "lucide-react"
import { AGES, type AgeId } from "@/core/ages"
import type { BuildingType } from "@/core/building"
import { isScorable } from "@/core/efficiency"
import { STATS, STAT_GROUPS, statsOfGroup, type StatDef, type StatKey } from "@/core/stats"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import type { BoostBases } from "@/core/efficiency"
import { setBoostBases, useBoostBases } from "./score-settings"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { localized, useI18n } from "@/lib/i18n"
import { fullStatLabel, scoreHint } from "./format"
import { StatIcon } from "./stat-icon"

const ALL_EVENTS = "__all__"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  )
}

type FiltersProps = {
  types: BuildingType[]
  type: BuildingType
  onTypeChange: (type: BuildingType) => void
  ages: AgeId[]
  age: AgeId
  onAgeChange: (age: AgeId) => void
  events: { value: string; label: string }[]
  event: string | undefined
  onEventChange: (event: string | undefined) => void
  visibleStats: StatKey[]
  onToggleStat: (key: StatKey, visible: boolean) => void
}

export function WikiFilters(props: FiltersProps) {
  const { t, locale } = useI18n()
  const typeItems = props.types.map((type) => ({ value: type, label: t.types[type] }))
  const ageItems = AGES.filter((age) => props.ages.includes(age.id)).map((age) => ({
    value: age.id,
    label: localized(age.name, locale),
  }))
  const eventItems = [{ value: ALL_EVENTS, label: t.wiki.allEvents }, ...props.events]

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label={t.wiki.type}>
        <Select
          items={typeItems}
          value={props.type}
          onValueChange={(value) => value && props.onTypeChange(value as BuildingType)}
        >
          <SelectTrigger className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="w-auto min-w-(--anchor-width)">
            {typeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {props.type !== "great_building" && (
        <>
          <Field label={t.wiki.age}>
            <Select
              items={ageItems}
              value={props.age}
              onValueChange={(value) => value && props.onAgeChange(value as AgeId)}
            >
              <SelectTrigger className="min-w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} className="w-auto min-w-(--anchor-width)">
                {ageItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </>
      )}

      {props.type === "special" && (
        <Field label={t.wiki.event}>
          <Select
            items={eventItems}
            value={props.event ?? ALL_EVENTS}
            onValueChange={(value) =>
              props.onEventChange(!value || value === ALL_EVENTS ? undefined : (value as string))
            }
          >
            <SelectTrigger className="min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="w-auto min-w-(--anchor-width)">
              {eventItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {props.type !== "great_building" && (
        <>
          <Field label={t.wiki.columns}>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <Columns3 />
                {props.visibleStats.length}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-96 w-60">
                {STAT_GROUPS.map((group, index) => (
                  <DropdownMenuGroup key={group}>
                    {index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel>{t.statGroups[group]}</DropdownMenuLabel>
                    {statsOfGroup(group).map((key) => (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={props.visibleStats.includes(key)}
                        onCheckedChange={(checked) => props.onToggleStat(key, checked)}
                        closeOnClick={false}
                      >
                        <StatIcon stat={key} />
                        {t.stats[key]}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Field>
        </>
      )}
    </div>
  )
}

const boostOf = (key: StatKey) => (STATS[key] as StatDef).boosts

// Daily production a percent boost applies to (+1% = 1% of it), shared by the whole site;
// the City tab fills it from the imported city
function BoostBaseInput({ boosts, value }: { boosts: keyof BoostBases; value: number }) {
  const { t } = useI18n()
  return (
    <label
      title={t.wiki.boostBaseHint}
      className="ml-6 flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground"
    >
      <Input
        type="number"
        min={0}
        step={100}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next) && next >= 0) setBoostBases({ [boosts]: next })
        }}
        className="h-7 w-20 px-1.5 text-xs"
        aria-label={t.wiki.boostBaseHint}
      />
      {t.wiki.perDay}
    </label>
  )
}

// Under the score panel, on the wiki and on the City tab
export function ScoreActions({
  onReset,
  onUncheckAll,
  scoreCount,
}: {
  onReset: () => void
  onUncheckAll: () => void
  scoreCount: number
}) {
  const { t } = useI18n()
  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={onReset}>
        <RotateCcw />
        {t.wiki.reset}
      </Button>
      <Button variant="ghost" size="sm" onClick={onUncheckAll} disabled={scoreCount === 0}>
        <SquareX />
        {t.wiki.uncheckAll}
      </Button>
    </div>
  )
}

type ScorePanelProps = {
  scoreKeys: StatKey[]
  onToggle: (key: StatKey, selected: boolean) => void
}

// Checkboxes of the stats counted in the score, grouped like the table
export function ScorePanel({ scoreKeys, onToggle }: ScorePanelProps) {
  const { t, locale } = useI18n()
  const bases = useBoostBases()
  return (
    <TooltipProvider delay={300}>
      <fieldset className="rounded-lg border p-3">
        <legend className="px-1 text-xs text-muted-foreground">{t.wiki.scoreLabel}</legend>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          {STAT_GROUPS.map((group) => {
            const keys = statsOfGroup(group).filter((key) => isScorable(key))
            if (!keys.length) return null
            return (
              <div key={group} className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t.statGroups[group]}</p>
                {keys.map((key) => (
                  <div key={key} className="flex flex-col gap-1">
                    <Tooltip>
                      <TooltipTrigger
                        render={<label />}
                        className="flex w-fit cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={scoreKeys.includes(key)}
                          onCheckedChange={(checked) => onToggle(key, checked)}
                        />
                        <StatIcon stat={key} />
                        {t.stats[key]}
                      </TooltipTrigger>
                      <TooltipContent side="right" className="flex-col items-start gap-0.5">
                        <span className="font-medium">{fullStatLabel(t, key)}</span>
                        {scoreHint(t, key, locale, bases).map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                    {/* Percent boosts: the daily production they apply to */}
                    {boostOf(key) && (
                      <BoostBaseInput boosts={boostOf(key)!} value={bases[boostOf(key)!]} />
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </fieldset>
    </TooltipProvider>
  )
}
