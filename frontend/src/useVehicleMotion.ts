import { useMemo, useRef } from 'react'
import { bearingDegrees, movedSince, nextStopToward, snapToRoute } from './geo'
import type { LatLon, Plot, Vehicle } from './types'

export const VEHICLE_POLL_MS = 8_000
export const VEHICLE_SLIDE_MS = 1_000

export type MovingVehicle = Vehicle &
  LatLon & {
    heading: number
    slide: boolean
  }

function isStopped(status?: string) {
  return status === 'STOPPED_AT'
}

function shortestHeading(from: number, to: number): number {
  const delta = ((to - from + 540) % 360) - 180
  return from + delta
}

function headingFor(
  from: LatLon,
  to: LatLon,
  vehicle: Vehicle,
  plot: Plot,
  previous: number | null,
): number {
  if (isStopped(vehicle.current_status) && previous != null) return previous
  const fromHeading = previous ?? 0
  const motion = movedSince(from, to, 8) ? bearingDegrees(from, to) : null
  if (motion != null) return shortestHeading(fromHeading, motion)
  const next = nextStopToward(to, vehicle.route, vehicle.direction_id, plot.pointsByRoute)
  if (next) {
    const aim = bearingDegrees(to, next)
    if (aim != null) return shortestHeading(fromHeading, aim)
  }
  return fromHeading
}

export function useVehicleMotion(vehicles: Vehicle[], plot: Plot): MovingVehicle[] {
  const headings = useRef(new Map<string, number>())
  const lastPos = useRef(new Map<string, LatLon>())
  const onLineById = useRef(new Map<string, boolean>())
  const segmentsRef = useRef(plot.segmentsByRoute)

  return useMemo(() => {
    const plotChanged = segmentsRef.current !== plot.segmentsByRoute
    segmentsRef.current = plot.segmentsByRoute
    const seen = new Set<string>()
    const marks: MovingVehicle[] = []

    for (const vehicle of vehicles) {
      if (!Number.isFinite(vehicle.latitude) || !Number.isFinite(vehicle.longitude)) {
        continue
      }
      const pos = snapToRoute(
        { lat: vehicle.latitude as number, lon: vehicle.longitude as number },
        vehicle.route,
        plot.segmentsByRoute,
      )
      const seenBefore = lastPos.current.has(vehicle.id)
      const prev = lastPos.current.get(vehicle.id) ?? pos
      const onLine = Boolean(
        vehicle.route && plot.segmentsByRoute.get(vehicle.route)?.length,
      )
      const snapOntoLine = onLine && !onLineById.current.get(vehicle.id)
      const slide =
        seenBefore &&
        !plotChanged &&
        !snapOntoLine &&
        movedSince(prev, pos, 8)
      const heading = headingFor(
        prev,
        pos,
        vehicle,
        plot,
        headings.current.get(vehicle.id) ?? null,
      )
      headings.current.set(vehicle.id, heading)
      lastPos.current.set(vehicle.id, pos)
      onLineById.current.set(vehicle.id, onLine)
      seen.add(vehicle.id)
      marks.push({ ...vehicle, ...pos, heading, slide })
    }

    for (const id of headings.current.keys()) {
      if (!seen.has(id)) {
        headings.current.delete(id)
        lastPos.current.delete(id)
        onLineById.current.delete(id)
      }
    }

    return marks
  }, [vehicles, plot])
}
