import {
  CircleArrowDown,
  CircleArrowUp,
  CircleHelp,
  CirclePause,
  Clock,
  Gauge,
  MapPin,
  Radio,
} from 'lucide-react'
import { Marker } from '@vis.gl/react-maplibre'
import { lighten, routeColor, withAlpha } from '@/colors'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { routeBadge, routeTitle } from '@/routeMeta'
import type { LatLon, NextStop, Vehicle } from '@/types'

type StatusKey = 'STOPPED_AT' | 'IN_TRANSIT_TO' | 'INCOMING_AT'

const STATUS: Record<
  StatusKey,
  { label: string; className: string; Icon: typeof CirclePause }
> = {
  STOPPED_AT: {
    label: 'Stopped',
    className: 'bg-rose-500/15 text-rose-300 ring-rose-400/35',
    Icon: CirclePause,
  },
  IN_TRANSIT_TO: {
    label: 'Moving',
    className: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/35',
    Icon: Gauge,
  },
  INCOMING_AT: {
    label: 'Arriving',
    className: 'bg-violet-500/15 text-violet-300 ring-violet-400/35',
    Icon: Radio,
  },
}

function mph(mps?: number) {
  if (!Number.isFinite(mps)) return null
  return Math.round((mps as number) * 2.23694)
}

function updatedLabel(iso?: string) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function VehicleIcon({ color, carriages }: { color: string; carriages: number }) {
  const scale = 1 + Math.min(Math.max(carriages, 1), 6) * 0.04
  const width = Math.round(16 * scale)
  const height = Math.round(18 * scale)

  return (
    <svg
      className="vehicle-mark"
      width={width}
      height={height}
      viewBox="0 0 16 18"
    >
      <ellipse
        className="vehicle-glow"
        cx="8"
        cy="10"
        rx="6.2"
        ry="5.4"
        fill={color}
      />
      <path
        d="M8 1.4C8.7 1.4 9.2 1.8 10 3.2L14.4 14.2c.35.85-.2 1.6-1.05 1.6H2.65c-.85 0-1.4-.75-1.05-1.6L6 3.2C6.8 1.8 7.3 1.4 8 1.4Z"
        fill={color}
        stroke="#fff"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
      <path
        d="M8 5.2 10.4 12.2H5.6Z"
        fill="white"
        fillOpacity="0.28"
      />
    </svg>
  )
}

function Carriages({ count, color }: { count: number; color: string }) {
  const cars = Math.min(Math.max(count, 0), 8)
  if (cars === 0) return <span className="text-white/40">—</span>
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: cars }, (_, i) => (
        <span
          key={i}
          className="h-3.5 w-2 rounded-[3px] first:rounded-l-md last:rounded-r-md"
          style={{ background: color }}
        />
      ))}
    </div>
  )
}

export function VehicleMark({
  vehicle,
  heading = 0,
  nextStop,
}: {
  vehicle: Vehicle & LatLon
  heading?: number
  nextStop?: NextStop | null
}) {
  const color = routeColor(vehicle.route)
  const title = vehicle.label || vehicle.id
  const status = vehicle.current_status
    ? STATUS[vehicle.current_status as StatusKey]
    : undefined
  const inbound = vehicle.direction_id === 1
  const outbound = vehicle.direction_id === 0
  const DirectionIcon = inbound
    ? CircleArrowDown
    : outbound
      ? CircleArrowUp
      : CircleHelp
  const speed = mph(vehicle.speed)
  const updated = updatedLabel(vehicle.updated_at)
  const StatusIcon = status?.Icon
  const showCars = (vehicle.carriages ?? 0) > 0

  return (
    <Marker longitude={vehicle.lon} latitude={vehicle.lat} anchor="center">
      <Popover modal={false}>
        <PopoverTrigger
          nativeButton
          openOnHover
          delay={80}
          closeDelay={120}
          aria-label={`${title}${vehicle.route ? ` · ${vehicle.route}` : ''}`}
          className={cn(
            'vehicle-hit',
            vehicle.current_status === 'IN_TRANSIT_TO' && 'is-moving',
            vehicle.current_status === 'STOPPED_AT' && 'is-stopped',
            vehicle.current_status === 'INCOMING_AT' && 'is-arriving',
          )}
        >
          <span
            className="vehicle-rotate"
            style={{ transform: `rotate(${heading}deg)` }}
          >
            <VehicleIcon color={color} carriages={vehicle.carriages} />
          </span>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          className="w-64 gap-0 overflow-hidden p-0"
        >
          <div className="h-1" style={{ background: color }} />
          <div className="flex items-start gap-2.5 px-3 pt-2.5 pb-2">
            <span
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold tracking-wide text-white"
              style={{ background: color }}
            >
              {routeBadge(vehicle.route)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium tracking-wide text-white/55 uppercase">
                {routeTitle(vehicle.route)}
              </p>
              <PopoverTitle className="truncate text-sm font-semibold tracking-tight">
                {title}
              </PopoverTitle>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 px-3">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium ring-1',
                inbound && 'bg-sky-500/15 text-sky-300 ring-sky-400/35',
                outbound && 'bg-amber-500/15 text-amber-300 ring-amber-400/35',
                !inbound &&
                  !outbound &&
                  'bg-white/5 text-white/50 ring-white/15',
              )}
            >
              <DirectionIcon className="size-3.5" />
              {inbound ? 'Inbound' : outbound ? 'Outbound' : 'Unknown'}
            </div>
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium ring-1',
                status?.className ?? 'bg-white/5 text-white/50 ring-white/15',
              )}
            >
              {StatusIcon ? (
                <StatusIcon className="size-3.5" />
              ) : (
                <CircleHelp className="size-3.5" />
              )}
              {status?.label ?? 'Unknown'}
            </div>
          </div>

          {nextStop && (
            <div className="mt-2 px-3">
              <div
                className="rounded-md px-2 py-1.5"
                style={{
                  background: withAlpha(color, 0.22),
                  color: lighten(color, 0.45),
                  boxShadow: `inset 0 0 0 1px ${withAlpha(color, 0.45)}`,
                }}
              >
                <p className="flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase opacity-80">
                  <MapPin className="size-3" />
                  Next stop
                </p>
                <p className="mt-1 truncate text-xs font-medium leading-tight">
                  {nextStop.name}
                </p>
                <p className="text-[10px] tabular-nums opacity-60">
                  {nextStop.miles.toFixed(2)} mi
                </p>
              </div>
            </div>
          )}

          <div
            className={cn(
              'mt-2 grid gap-px bg-white/10',
              showCars ? 'grid-cols-2' : 'grid-cols-1',
            )}
          >
            <div className="bg-popover px-3 py-2.5">
              <p className="text-[10px] tracking-wide text-white/40 uppercase">
                Speed
              </p>
              <p className="mt-0.5 text-lg leading-none font-semibold tabular-nums">
                {speed == null ? '—' : speed}
                {speed != null && (
                  <span className="ml-1 text-[10px] font-medium text-white/40">
                    mph
                  </span>
                )}
              </p>
            </div>
            {showCars && (
              <div className="bg-popover px-3 py-2.5">
                <p className="text-[10px] tracking-wide text-white/40 uppercase">
                  {vehicle.carriages === 1 ? 'Car' : 'Cars'}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <Carriages count={vehicle.carriages} color={color} />
                  <span className="text-sm font-semibold tabular-nums">
                    {vehicle.carriages}
                  </span>
                </div>
              </div>
            )}
          </div>

          {updated && (
            <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-white/40">
              <Clock className="size-3" />
              Updated {updated}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </Marker>
  )
}
