import { useEffect, useState } from 'react'
import { ArrowLeftRight, CircleArrowDown, CircleArrowUp, MapPin, TrainFront } from 'lucide-react'
import { Marker } from '@vis.gl/react-maplibre'
import { LINE_COLORS, lighten, routeColor, stationColors, withAlpha } from '@/colors'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { isCommuterRoute, routeBadge } from '@/routeMeta'
import type { MapStation, NextStop } from '@/types'

function StationIcon({
  keys,
  commuterOnly,
  transfer,
}: {
  keys: ReturnType<typeof stationColors>
  commuterOnly: boolean
  transfer: boolean
}) {
  const size = transfer ? 20 : commuterOnly ? 15 : 14
  const fill = LINE_COLORS[keys[0]]

  if (commuterOnly && !transfer) {
    return (
      <svg
        className="station-mark"
        width={size}
        height={size}
        viewBox="-8 -8 16 16"
      >
        <rect
          x="-4.1"
          y="-4.1"
          width="8.2"
          height="8.2"
          rx="1.1"
          transform="rotate(45)"
          fill={fill}
          stroke="#fff"
          strokeWidth="1.4"
        />
      </svg>
    )
  }

  return (
    <svg
      className="station-mark"
      width={size}
      height={size}
      viewBox="-9 -9 18 18"
    >
      {keys.map((key, i) => (
        <circle
          key={key}
          r={3.4 + (keys.length - 1 - i) * 1.85}
          fill="none"
          stroke={LINE_COLORS[key]}
          strokeWidth={transfer ? 1.7 : 2}
        />
      ))}
      <circle r="2.35" fill="#fff" />
    </svg>
  )
}

function formatCoord(lat: number, lon: number) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}° ${ns}  ${Math.abs(lon).toFixed(4)}° ${ew}`
}

function NextStops({
  label,
  Icon,
  stops,
  color,
  shade,
  onGoToStation,
}: {
  label: string
  Icon: typeof CircleArrowUp
  stops: NextStop[]
  color: string
  shade: 'light' | 'deep'
  onGoToStation: (stop: NextStop) => void
}) {
  const fill = withAlpha(color, shade === 'light' ? 0.28 : 0.14)
  const ring = withAlpha(color, shade === 'light' ? 0.5 : 0.35)
  const text = lighten(color, shade === 'light' ? 0.55 : 0.32)

  return (
    <div
      className="rounded-md px-2 py-1.5"
      style={{ background: fill, color: text, boxShadow: `inset 0 0 0 1px ${ring}` }}
    >
      <p className="flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase opacity-80">
        <Icon className="size-3" />
        {label}
      </p>
      {stops.length === 0 ? (
        <p className="mt-1 truncate text-xs opacity-55">Terminus</p>
      ) : (
        stops.map((stop) => (
          <button
            key={stop.name}
            type="button"
            className="mt-1 block w-full min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left font-inherit text-inherit"
            onClick={(event) => {
              event.stopPropagation()
              onGoToStation(stop)
            }}
          >
            <p className="truncate text-xs font-medium leading-tight underline-offset-2 hover:underline">
              {stop.name}
            </p>
            <p className="text-[10px] tabular-nums opacity-60">
              {stop.miles.toFixed(2)} mi
            </p>
          </button>
        ))
      )}
    </div>
  )
}

function LinePill({
  line,
  highlighted,
  compact,
  onHighlight,
}: {
  line: string
  highlighted: boolean
  compact?: boolean
  onHighlight: (route: string) => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'cursor-pointer font-bold tracking-wide text-white uppercase',
        compact
          ? 'rounded px-1 py-px text-[9px]'
          : 'rounded-md px-1.5 py-0.5 text-[10px]',
        highlighted && 'ring-2 ring-white/90',
      )}
      style={{ background: routeColor(line) }}
      title={line}
      aria-pressed={highlighted}
      onClick={(event) => {
        event.stopPropagation()
        onHighlight(line)
      }}
    >
      {routeBadge(line)}
    </button>
  )
}

export function StationMark({
  station,
  highlightedRoute,
  focused,
  anyFocused,
  onHighlightRoute,
  onDismissFocus,
  onGoToStation,
}: {
  station: MapStation
  highlightedRoute: string | null
  focused: boolean
  anyFocused: boolean
  onHighlightRoute: (route: string) => void
  onDismissFocus: () => void
  onGoToStation: (stop: NextStop) => void
}) {
  const [hoverOpen, setHoverOpen] = useState(false)
  const keys = stationColors(station.lines)
  const open = focused || (!anyFocused && hoverOpen)

  useEffect(() => {
    if (!focused) setHoverOpen(false)
  }, [focused, anyFocused])

  if (keys.length === 0) return null

  const colors = station.lines.map((line) => routeColor(line))
  const accent = colors[0] ?? LINE_COLORS[keys[0]]
  const transfer = station.lines.length > 1
  const commuterOnly = station.lines.every(isCommuterRoute)
  return (
    <Marker longitude={station.lon} latitude={station.lat} anchor="center">
      <Popover
        modal={false}
        open={open}
        onOpenChange={(next, details) => {
          if (focused) {
            if (!next && details.reason !== 'trigger-hover') onDismissFocus()
            return
          }
          setHoverOpen(next)
        }}
      >
        <PopoverTrigger
          nativeButton
          openOnHover
          delay={80}
          closeDelay={120}
          aria-label={station.name}
          className="station-hit"
        >
          <StationIcon
            keys={keys}
            commuterOnly={commuterOnly}
            transfer={transfer}
          />
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          className="w-72 gap-0 overflow-hidden p-0"
        >
          <div className="flex h-1">
            {colors.map((color, i) => (
              <span
                key={`${station.lines[i]}-${i}`}
                className="h-full flex-1"
                style={{ background: color }}
              />
            ))}
          </div>

          <div className="px-3 pt-2.5 pb-2">
            <p className="text-[11px] font-medium tracking-wide text-white/55 uppercase">
              {transfer ? 'Transfer station' : commuterOnly ? 'Commuter rail' : 'Rapid transit'}
            </p>
            <PopoverTitle className="truncate text-sm font-semibold tracking-tight">
              {station.name}
            </PopoverTitle>
          </div>

          <div className="flex flex-wrap gap-1 px-3">
            {station.lines.map((line) => (
              <LinePill
                key={line}
                line={line}
                highlighted={highlightedRoute === line}
                onHighlight={onHighlightRoute}
              />
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5 px-3">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium ring-1',
                transfer && 'bg-sky-500/15 text-sky-300 ring-sky-400/35',
                !transfer &&
                  commuterOnly &&
                  'bg-violet-500/15 text-violet-300 ring-violet-400/35',
                !transfer &&
                  !commuterOnly &&
                  'bg-emerald-500/15 text-emerald-300 ring-emerald-400/35',
              )}
            >
              {transfer ? (
                <ArrowLeftRight className="size-3.5" />
              ) : (
                <TrainFront className="size-3.5" />
              )}
              {transfer ? 'Transfer' : commuterOnly ? 'Commuter' : 'Subway'}
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1.5 text-xs font-medium text-white/70 ring-1 ring-white/15">
              <span
                className="size-2 rounded-full"
                style={{ background: accent }}
              />
              {station.lines.length}{' '}
              {station.lines.length === 1 ? 'line' : 'lines'}
            </div>
          </div>

          {station.neighbors.length > 0 && (
            <div className="mt-2 border-t border-white/10">
              {station.neighbors.map((group) => (
                <div
                  key={group.routes.join('-')}
                  className="border-b border-white/10 px-3 py-2 last:border-b-0"
                >
                  {station.neighbors.length > 1 && (
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {group.routes.map((line) => (
                        <LinePill
                          key={line}
                          line={line}
                          compact
                          highlighted={highlightedRoute === line}
                          onHighlight={onHighlightRoute}
                        />
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    <NextStops
                      label="Outbound"
                      Icon={CircleArrowUp}
                      stops={group.outbound}
                      color={routeColor(group.routes[0])}
                      shade="light"
                      onGoToStation={onGoToStation}
                    />
                    <NextStops
                      label="Inbound"
                      Icon={CircleArrowDown}
                      stops={group.inbound}
                      color={routeColor(group.routes[0])}
                      shade="deep"
                      onGoToStation={onGoToStation}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-white/40">
            <MapPin className="size-3" />
            {formatCoord(station.lat, station.lon)}
          </div>
        </PopoverContent>
      </Popover>
    </Marker>
  )
}
