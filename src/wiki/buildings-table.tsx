import { useMemo, useState } from "react"
import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type Header,
  type SortingState,
} from "@tanstack/react-table"
import { Link, getRouteApi } from "@tanstack/react-router"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { STATS, STAT_KEYS, type StatKey } from "@/core/stats"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { localized, useI18n, type Locale, type Messages } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { CompareButton } from "@/compare/compare-button"
import { BuildingCard } from "./building-card"
import { eventLabel, formatNumber, formatStat, fullStatLabel } from "./format"
import { ScorePill } from "./score-pill"
import { StatIcon } from "./stat-icon"
import type { WikiRow } from "./data"

const features = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
})

const helper = createColumnHelper<typeof features, WikiRow>()

function buildColumns(t: Messages, locale: Locale) {
  return helper.columns([
    helper.accessor((row) => localized(row.building.name, locale), {
      id: "name",
      header: t.wiki.building,
      sortFn: "text",
      enableHiding: false,
      cell: ({ row }) => <NameCell row={row.original} />,
    }),
    // Score as a colored pill (see scoreColor), right after the name
    helper.accessor((row) => row.score, {
      id: "score",
      header: t.wiki.score,
      sortDescFirst: true,
      enableHiding: false,
      cell: ({ row }) => <ScorePill score={row.original.score} className="min-w-14" />,
    }),
    helper.accessor((row) => row.tiles, {
      id: "tiles",
      header: t.wiki.tiles,
      enableHiding: false,
      cell: ({ row }) => {
        const { building, tiles } = row.original
        return (
          <>
            {formatNumber(tiles, locale, 1)}
            <Sub>
              {building.size.w}x{building.size.h}
              {building.road !== "none" && ` + ${t.wiki.roadShort}`}
            </Sub>
          </>
        )
      },
    }),
    ...STAT_KEYS.map((key): ColumnDef<typeof features, WikiRow, any> =>
      // Sorted on the value per tile: the point of the whole table
      helper.accessor((row) => (row.stats[key] ? row.stats[key] / row.tiles : undefined), {
        id: key,
        header: t.stats[key],
        sortDescFirst: true,
        sortUndefined: "last",
        cell: ({ row }) => {
          const value = row.original.stats[key]
          if (!value) return <span className="text-muted-foreground">–</span>
          return (
            <>
              {formatStat(key, value, locale, 1)}
              <Sub>
                {formatStat(key, value / row.original.tiles, locale, 2)}
                {t.wiki.perTile}
              </Sub>
            </>
          )
        },
      }),
    ),
  ])
}

function Sub({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs text-muted-foreground">{children}</span>
}

const wikiRoute = getRouteApi("/wiki")

// Hovering shows the card, clicking opens the building page at the same age
function NameCell({ row }: { row: WikiRow }) {
  const { locale } = useI18n()
  const { age } = wikiRoute.useSearch()
  const { building } = row
  return (
    <div className="flex items-start justify-between gap-1">
      <div className="min-w-0">
        <HoverCard>
          <HoverCardTrigger
            render={<Link to="/buildings/$id" params={{ id: building.id }} search={{ age }} />}
            className="font-medium underline decoration-dotted underline-offset-4 hover:text-primary"
          >
            {localized(building.name, locale)}
          </HoverCardTrigger>
          <HoverCardContent side="right" align="start" className="w-80">
            <BuildingCard building={building} />
          </HoverCardContent>
        </HoverCard>
        {building.event && <Sub>{eventLabel(building, locale)}</Sub>}
      </div>
      <CompareButton
        iconOnly
        className="shrink-0"
        item={{ kind: "building", id: building.id, name: building.name, image: building.image }}
      />
    </div>
  )
}

function SortableHeader({ header }: { header: Header<typeof features, WikiRow, unknown> }) {
  const { t } = useI18n()
  const sorted = header.column.getIsSorted()
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown
  const stat = header.column.id in STATS ? (header.column.id as StatKey) : undefined
  return (
    <button
      type="button"
      // Without group headers, the full label tells "Cl. att" of both armies apart
      title={stat && fullStatLabel(t, stat)}
      onClick={header.column.getToggleSortingHandler()}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground",
        sorted && "text-foreground",
      )}
    >
      {stat && <StatIcon stat={stat} />}
      {header.column.columnDef.header as string}
      <Icon className={cn("size-3.5", !sorted && "opacity-40")} />
    </button>
  )
}

type Props = {
  rows: WikiRow[]
  visibleStats: StatKey[]
  showScore: boolean
}

export function BuildingsTable({ rows, visibleStats, showScore }: Props) {
  const { t, locale } = useI18n()
  const columns = useMemo(() => buildColumns(t, locale), [t, locale])
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }])

  const columnVisibility = useMemo<ColumnVisibilityState>(() => {
    const visible = new Set<string>(visibleStats)
    const state: ColumnVisibilityState = { score: showScore }
    for (const key of Object.keys(STATS)) state[key] = visible.has(key)
    return state
  }, [visibleStats, showScore])

  // Sorting on the hidden score column makes no sense: fall back to tiles
  const effectiveSorting =
    !showScore && sorting[0]?.id === "score" ? [{ id: "tiles", desc: false }] : sorting

  const table = useTable({
    features,
    columns,
    data: rows,
    state: { sorting: effectiveSorting, columnVisibility },
    onSortingChange: setSorting,
    enableSortingRemoval: false,
  })

  const sortedRows = table.getRowModel().rows

  if (!sortedRows.length) {
    return <p className="py-10 text-center text-muted-foreground">{t.wiki.empty}</p>
  }

  // Every row is rendered, columns sized by their content; the page scrolls
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/40">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn(
                    "border-b px-3 py-2 font-medium text-muted-foreground",
                    header.column.id === "name" || header.column.id === "score"
                      ? "text-left"
                      : "text-right",
                  )}
                >
                  <SortableHeader header={header} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            // Off-screen rows skip layout and paint until scrolled to
            <tr
              key={row.id}
              className="border-b [contain-intrinsic-size:auto_56px] [content-visibility:auto] last:border-0 hover:bg-muted/30"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cn(
                    "px-3 py-2 align-top whitespace-nowrap",
                    cell.column.id === "name"
                      ? "min-w-56 text-left whitespace-normal"
                      : cell.column.id === "score"
                        ? "text-left"
                        : "text-right",
                  )}
                >
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
