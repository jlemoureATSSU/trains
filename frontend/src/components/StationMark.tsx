import { ArrowLeftRight, MapPin, TrainFront } from 'lucide-react'
import { Marker } from '@vis.gl/react-maplibre'
import { LINE_COLORS, routeColor, stationColors } from '@/colors'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { isCommuterRoute, routeBadge } from '@/routeMeta'
import type { MapStation } from '@/types'

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

export function StationMark({ station }: { station: MapStation }) {
  const keys = stationColors(station.lines)
  if (keys.length === 0) return null

  const colors = station.lines.map((line) => routeColor(line))
  const accent = colors[0] ?? LINE_COLORS[keys[0]]
  const transfer = station.lines.length > 1
  const commuterOnly = station.lines.every(isCommuterRoute)
  return (
    <Marker longitude={station.lon} latitude={station.lat} anchor="center">
      <Popover modal={false}>
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
          className="w-64 gap-0 overflow-hidden p-0"
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
            {station.lines.map((line) => {
              const color = routeColor(line)
              return (
                <span
                  key={line}
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase"
                  style={{ background: color }}
                  title={line}
                >
                  {routeBadge(line)}
                </span>
              )
            })}
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

          <div className="mt-2 flex items-center gap-1.5 px-3 py-2 text-[11px] text-white/40">
            <MapPin className="size-3" />
            {formatCoord(station.lat, station.lon)}
          </div>
        </PopoverContent>
      </Popover>
    </Marker>
  )
}
