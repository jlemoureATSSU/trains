import type { LatLon, Line, LinePoint, MapStation, Plot, Segment } from './types'

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

  return { stations, lines: mappedLines, segmentsByRoute }
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
