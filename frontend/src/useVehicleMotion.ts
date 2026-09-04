import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  bearingDegrees,
  lerpLatLon,
  movedSince,
  nextStopToward,
  snapToRoute,
} from './geo'
import type { LatLon, Plot, Vehicle } from './types'

export const VEHICLE_POLL_MS = 8_000

export type MovingVehicle = Vehicle &
  LatLon & {
    heading: number
  }

type Track = {
  from: LatLon
  to: LatLon
  startedAt: number
  duration: number
  heading: number
  onLine: boolean
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

function at(track: Track, now: number): LatLon {
  if (track.duration <= 0) return track.to
  return lerpLatLon(track.from, track.to, (now - track.startedAt) / track.duration)
}

export function useVehicleMotion(vehicles: Vehicle[], plot: Plot): MovingVehicle[] {
  const tracks = useRef(new Map<string, Track>())
  const segmentsRef = useRef(plot.segmentsByRoute)
  const [now, setNow] = useState(() => performance.now())

  const snapped = useMemo(
    () =>
      vehicles
        .filter(
          (v): v is Vehicle & { latitude: number; longitude: number } =>
            Number.isFinite(v.latitude) && Number.isFinite(v.longitude),
        )
        .map((v) => ({
          ...v,
          ...snapToRoute(
            { lat: v.latitude, lon: v.longitude },
            v.route,
            plot.segmentsByRoute,
          ),
        })),
    [vehicles, plot.segmentsByRoute],
  )

  useLayoutEffect(() => {
    const t = performance.now()
    const seen = new Set<string>()
    const plotChanged = segmentsRef.current !== plot.segmentsByRoute
    segmentsRef.current = plot.segmentsByRoute
    let jumped = false

    for (const vehicle of snapped) {
      seen.add(vehicle.id)
      const target = { lat: vehicle.lat, lon: vehicle.lon }
      const prev = tracks.current.get(vehicle.id)
      const onLine = Boolean(
        vehicle.route && plot.segmentsByRoute.get(vehicle.route)?.length,
      )

      if (!prev) {
        tracks.current.set(vehicle.id, {
          from: target,
          to: target,
          startedAt: t,
          duration: 0,
          heading: headingFor(target, target, vehicle, plot, null),
          onLine,
        })
        continue
      }

      if (!movedSince(prev.to, target, 15)) {
        prev.heading = headingFor(prev.from, prev.to, vehicle, plot, prev.heading)
        prev.onLine = onLine
        continue
      }

      const instant = plotChanged || (onLine && !prev.onLine)
      const current = instant ? target : at(prev, t)
      tracks.current.set(vehicle.id, {
        from: current,
        to: target,
        startedAt: t,
        duration: instant ? 0 : VEHICLE_POLL_MS,
        heading: headingFor(current, target, vehicle, plot, prev.heading),
        onLine,
      })
      if (instant) jumped = true
    }

    for (const id of tracks.current.keys()) {
      if (!seen.has(id)) tracks.current.delete(id)
    }

    if (jumped) setNow(t)
  }, [snapped, plot])

  useEffect(() => {
    let frame = 0
    let last = 0
    const tick = (time: number) => {
      if (time - last >= 33) {
        last = time
        setNow(time)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return snapped.map((vehicle) => {
    const track = tracks.current.get(vehicle.id)
    if (!track) {
      return { ...vehicle, heading: 0 }
    }
    const pos = at(track, now)
    return {
      ...vehicle,
      ...pos,
      heading: track.heading,
    }
  })
}
