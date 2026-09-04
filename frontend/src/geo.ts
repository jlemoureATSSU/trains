import type { LatLon, Line, LinePoint, MapStation, Plot, Segment } from './types'
import { lineLabel } from './routeMeta'

function isCommuter(route: string | null | undefined): boolean {
  return (route || '').toLowerCase().startsWith('cr-')
}

function nameKey(name: string | null | undefined): string {
  return (name || '').toLowerCase()
}

function stationsFromLines(lines: Line[]): MapStation[] {
  const byName = new Map<string, MapStation>()
  for (const line of lines) {
    for (const point of line.points ?? []) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue
      const key = nameKey(point.name)
      if (!key) continue
      let station = byName.get(key)
      if (!station) {
        station = {
          name: point.name ?? key,
          lat: point.lat,
          lon: point.lon,
          lines: [],
          fromCr: isCommuter(line.route),
        }
        byName.set(key, station)
      } else if (station.fromCr && !isCommuter(line.route)) {
        station.lat = point.lat
        station.lon = point.lon
        station.fromCr = false
      }
      if (line.route && !station.lines.includes(line.route)) {
        station.lines.push(line.route)
      }
    }
  }
  return [...byName.values()]
}

function usablePoints(points: LinePoint[] | undefined): LinePoint[] {
  return (points ?? []).filter(
    (p): p is LinePoint & { name: string } =>
      Boolean(p.name) && Number.isFinite(p.lat) && Number.isFinite(p.lon),
  )
}

function subpath(
  points: LinePoint[],
  a: string,
  b: string,
): LinePoint[] | null {
  const keys = points.map((p) => nameKey(p.name))
  const i = keys.indexOf(a)
  const j = keys.indexOf(b)
  if (i < 0 || j < 0 || i === j) return null
  return i < j ? points.slice(i, j + 1) : points.slice(j, i + 1).reverse()
}

function threadCommuter(lines: Line[]): Line[] {
  const guides = lines
    .filter((line) => !isCommuter(line.route))
    .map((line) => usablePoints(line.points))

  return lines.map((line) => {
    const points = usablePoints(line.points)
    if (!isCommuter(line.route) || points.length < 2) {
      return { ...line, points }
    }

    const threaded = [points[0]]
    for (let i = 0; i < points.length - 1; i++) {
      const a = nameKey(points[i].name)
      const b = nameKey(points[i + 1].name)
      let detour: LinePoint[] | null = null
      for (const guide of guides) {
        const path = subpath(guide, a, b)
        if (path && path.length > 2 && (!detour || path.length > detour.length)) {
          detour = path
        }
      }
      threaded.push(...(detour ? detour.slice(1) : [points[i + 1]]))
    }
    return { ...line, points: threaded }
  })
}

export function prepareMap(lines: Line[]): Plot {
  const stations = stationsFromLines(lines)
  const byName = new Map(stations.map((s) => [s.name.toLowerCase(), s]))
  const drawn = threadCommuter(lines)
  const crFirst = (a: Line, b: Line) =>
    Number(isCommuter(b.route)) - Number(isCommuter(a.route))

  const mappedLines = drawn.sort(crFirst).map((line) => ({
    ...line,
    points: line.points.map((p) => {
      const station = byName.get(nameKey(p.name))
      const coords = station ?? p
      return { ...p, lat: coords.lat, lon: coords.lon }
    }),
  }))

  const segmentsByRoute = new Map<string, Segment[]>()
  for (const line of mappedLines) {
    if (!line.route || line.points.length < 2) continue
    const segs = segmentsByRoute.get(line.route) ?? []
    for (let i = 0; i < line.points.length - 1; i++) {
      const a = line.points[i]
      const b = line.points[i + 1]
      segs.push({
        a: { lat: a.lat, lon: a.lon },
        b: { lat: b.lat, lon: b.lon },
      })
    }
    segmentsByRoute.set(line.route, segs)
  }

  const pointsByRoute = new Map<string, LatLon[]>()
  for (const line of mappedLines) {
    if (!line.route || line.points.length === 0) continue
    if (!pointsByRoute.has(line.route)) {
      pointsByRoute.set(
        line.route,
        line.points.map((p) => ({ lat: p.lat, lon: p.lon })),
      )
    }
  }

  return { stations, lines: mappedLines, segmentsByRoute, pointsByRoute }
}

export function linesToGeoJSON(lines: Line[]) {
  return {
    type: 'FeatureCollection' as const,
    features: lines
      .filter((line) => line.points.length >= 2)
      .map((line) => ({
        type: 'Feature' as const,
        properties: {
          color: line.color,
          commuter: isCommuter(line.route) ? 1 : 0,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: line.points.map((p) => [p.lon, p.lat]),
        },
      })),
  }
}

function distMeters(a: LatLon, b: LatLon): number {
  const lonScale = Math.cos((a.lat * Math.PI) / 180)
  const dx = (a.lon - b.lon) * lonScale * 111_320
  const dy = (a.lat - b.lat) * 111_320
  return Math.hypot(dx, dy)
}

function pathLengths(points: LatLon[]): { cum: number[]; total: number } {
  const cum = [0]
  for (let i = 0; i < points.length - 1; i++) {
    cum.push(cum[i] + distMeters(points[i], points[i + 1]))
  }
  return { cum, total: cum[cum.length - 1] ?? 0 }
}

function sliceAroundLength(
  points: LatLon[],
  cum: number[],
  target: number,
  minMeters: number,
): LatLon[] {
  let i = 0
  while (i < cum.length - 2 && cum[i + 1] < target) i++
  let j = Math.min(i + 1, points.length - 1)
  while (j < points.length - 1 && cum[j] - cum[i] < minMeters) j++
  if (j <= i) return points.slice(i, i + 2)
  return points.slice(i, j + 1)
}

function sliceCenter(points: LatLon[]): LatLon {
  const mid = points[Math.floor(points.length / 2)] ?? points[0]
  return { lat: mid.lat, lon: mid.lon }
}

const LABEL_GAP_METERS = 2_400
const LABEL_SLICE_METERS = 450

export function lineLabelsToGeoJSON(lines: Line[]) {
  const byRoute = new Map<string, Line[]>()
  for (const line of lines) {
    if (line.points.length < 2) continue
    const key = line.route || line.id
    const group = byRoute.get(key) ?? []
    group.push(line)
    byRoute.set(key, group)
  }

  const features: {
    type: 'Feature'
    properties: { name: string; color: string; commuter: number }
    geometry: { type: 'LineString'; coordinates: number[][] }
  }[] = []
  const placed: { name: string; lat: number; lon: number }[] = []

  const tooClose = (name: string, at: LatLon) =>
    placed.some(
      (prev) =>
        prev.name === name &&
        distMeters(at, { lat: prev.lat, lon: prev.lon }) < LABEL_GAP_METERS,
    )

  for (const group of byRoute.values()) {
    group.sort(
      (a, b) => pathLengths(b.points).total - pathLengths(a.points).total,
    )

    group.forEach((line, index) => {
      const name = lineLabel(line.route)
      if (!name) return
      const { cum, total } = pathLengths(line.points)
      if (total < 80) return

      const want = index === 0 ? (total > 16_000 ? 3 : 2) : 1
      const fractions =
        index === 0
          ? Array.from({ length: want }, (_, k) => (k + 1) / (want + 1))
          : [0.78]

      for (const t of fractions) {
        const slice = sliceAroundLength(
          line.points,
          cum,
          total * t,
          LABEL_SLICE_METERS,
        )
        if (slice.length < 2) continue
        const at = sliceCenter(slice)
        if (tooClose(name, at)) continue
        placed.push({ name, lat: at.lat, lon: at.lon })
        features.push({
          type: 'Feature' as const,
          properties: {
            name,
            color: line.color,
            commuter: isCommuter(line.route) ? 1 : 0,
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: slice.map((p) => [p.lon, p.lat]),
          },
        })
      }
    })
  }

  return {
    type: 'FeatureCollection' as const,
    features,
  }
}

function nearestOnSegments(point: LatLon, segments: Segment[]): LatLon {
  const lonScale = Math.cos((point.lat * Math.PI) / 180)
  const x = point.lon * lonScale
  const y = point.lat
  let bestX = x
  let bestY = y
  let best = Infinity
  for (const { a, b } of segments) {
    const ax = a.lon * lonScale
    const ay = a.lat
    const bx = b.lon * lonScale
    const by = b.lat
    const vx = bx - ax
    const vy = by - ay
    const len2 = vx * vx + vy * vy
    const t =
      len2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2))
    const px = ax + t * vx
    const py = ay + t * vy
    const d2 = (x - px) ** 2 + (y - py) ** 2
    if (d2 < best) {
      best = d2
      bestX = px
      bestY = py
    }
  }
  return { lon: bestX / lonScale, lat: bestY }
}

export function snapToRoute(
  point: LatLon,
  route: string | null | undefined,
  segmentsByRoute: Map<string, Segment[]>,
): LatLon {
  if (!route) return point
  const segments = segmentsByRoute.get(route)
  if (!segments?.length) return point
  return nearestOnSegments(point, segments)
}

function dist2(a: LatLon, b: LatLon): number {
  const lonScale = Math.cos((a.lat * Math.PI) / 180)
  const dx = (a.lon - b.lon) * lonScale
  const dy = a.lat - b.lat
  return dx * dx + dy * dy
}

export function movedSince(a: LatLon, b: LatLon, meters = 20): boolean {
  const deg = meters / 111_320
  return dist2(a, b) > deg * deg
}

export function lerpLatLon(from: LatLon, to: LatLon, t: number): LatLon {
  const u = Math.max(0, Math.min(1, t))
  return {
    lat: from.lat + (to.lat - from.lat) * u,
    lon: from.lon + (to.lon - from.lon) * u,
  }
}

export function bearingDegrees(from: LatLon, to: LatLon): number | null {
  const lonScale = Math.cos((from.lat * Math.PI) / 180)
  const dx = (to.lon - from.lon) * lonScale
  const dy = to.lat - from.lat
  if (dx * dx + dy * dy < 1e-16) return null
  return (Math.atan2(dx, dy) * 180) / Math.PI
}

export function nextStopToward(
  point: LatLon,
  route: string | null | undefined,
  directionId: number | null | undefined,
  pointsByRoute: Map<string, LatLon[]>,
): LatLon | null {
  if (!route) return null
  const points = pointsByRoute.get(route)
  if (!points || points.length < 2) return null

  let best = 0
  let bestD = Infinity
  for (let i = 0; i < points.length; i++) {
    const d = dist2(point, points[i])
    if (d < bestD) {
      bestD = d
      best = i
    }
  }

  const step = directionId === 1 ? -1 : 1
  const next = best + step
  if (next >= 0 && next < points.length) return points[next]
  return null
}
