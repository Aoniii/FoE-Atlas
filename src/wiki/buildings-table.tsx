import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useWindowVirtualizer } from "@tanstack/react-virtual"
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

// Column widths in px, from the longest content of each column over all rows (text measured
// with the page font): cell padding 24, header icons and sort arrow ~44
const PADDING = 24
const NAME_MAX = 320
function measureWidths(
  rows: WikiRow[],
  columnIds: string[],
  t: Messages,
  locale: Locale,
): Record<string, number> {
  const context = document.createElement("canvas").getContext("2d")
  const family = getComputedStyle(document.body).fontFamily
  const measure = (text: string, size: number, weight = 400) => {
    if (!context) return text.length * size * 0.6
    context.font = `${weight} ${size}px ${family}`
    return context.measureText(text).width
  }
  const widths: Record<string, number> = {}
  for (const id of columnIds) {
    const stat = id in STATS ? (id as StatKey) : undefined
    const label = stat
      ? t.stats[stat]
      : id === "tiles"
        ? t.wiki.tiles
        : id === "score"
          ? t.wiki.score
          : t.wiki.building
    let width = measure(label, 14, 500) + 44
    if (id === "name") {
      // Names wrap: as wide as the longest one, up to NAME_MAX, plus the compare button
      for (const { building } of rows) {
        width = Math.max(
          width,
          Math.min(measure(localized(building.name, locale), 14, 500) + 32, NAME_MAX),
        )
      }
    } else if (id === "score") {
      width = Math.max(width, 64)
    } else if (id === "tiles") {
      for (const { building, tiles } of rows) {
        const size = `${building.size.w}x${building.size.h}${building.road !== "none" ? ` + ${t.wiki.roadShort}` : ""}`
        width = Math.max(width, measure(formatNumber(tiles, locale, 1), 14), measure(size, 12))
      }
    } else if (stat) {
      for (const row of rows) {
        const value = row.stats[stat]
        if (!value) continue
        width = Math.max(
          width,
          measure(formatStat(stat, value, locale, 1), 14),
          measure(`${formatStat(stat, value / row.tiles, locale, 2)}${t.wiki.perTile}`, 12),
        )
      }
    }
    widths[id] = Math.ceil(width + PADDING)
  }
  return widths
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
  const leafColumns = table.getVisibleLeafColumns()
  const columnIds = leafColumns.map((column) => column.id)
  // Widths from the content of every row (not only those on screen): they never change
  // while scrolling, which rendering only the visible rows needs
  const widths = useMemo(
    () => measureWidths(rows, columnIds, t, locale),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- columnIds is derived from visibility
    [rows, columnIds.join(), t, locale],
  )

  // Only the rows on screen are rendered; the page scrolls, empty rows above and below
  // keep its height. The list starts where the tbody starts.
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  useLayoutEffect(() => {
    // Content above the table (score panel...) can change height: measure again on resize
    const update = () =>
      setScrollMargin(
        Math.round((bodyRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY),
      )
    update()
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [])
  // oxlint-disable-next-line react/incompatible-library -- TanStack Virtual, no React Compiler here
  const virtualizer = useWindowVirtualizer({
    count: sortedRows.length,
    estimateSize: () => 56,
    overscan: 10,
    scrollMargin,
    getItemKey: (index) => sortedRows[index].id,
  })
  const items = virtualizer.getVirtualItems()
  const paddingTop = items.length ? items[0].start - scrollMargin : 0
  const paddingBottom = items.length
    ? virtualizer.getTotalSize() - (items[items.length - 1].end - scrollMargin)
    : 0
  const tableWidth = columnIds.reduce((sum, id) => sum + widths[id], 0)

  if (!sortedRows.length) {
    return <p className="py-10 text-center text-muted-foreground">{t.wiki.empty}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table
        className="w-full table-fixed border-collapse text-sm"
        style={{ minWidth: tableWidth }}
      >
        <colgroup>
          {columnIds.map((id) => (
            <col key={id} style={{ width: widths[id] }} />
          ))}
        </colgroup>
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
        <tbody ref={bodyRef}>
          {paddingTop > 0 && (
            <tr aria-hidden>
              <td colSpan={columnIds.length} style={{ height: paddingTop }} />
            </tr>
          )}
          {items.map((item) => {
            const row = sortedRows[item.index]
            return (
              <tr
                key={row.id}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="border-b last:border-0 hover:bg-muted/30"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      "px-3 py-2 align-top whitespace-nowrap",
                      cell.column.id === "name"
                        ? "text-left whitespace-normal"
                        : cell.column.id === "score"
                          ? "text-left"
                          : "text-right",
                    )}
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            )
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden>
              <td colSpan={columnIds.length} style={{ height: paddingBottom }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
