// Fit lat/lon into a rectangle without stretching.
// Longitude degrees are shorter than latitude at Boston (~42°N),
// so we scale lon by cos(mean lat) before mapping to pixels.

function isCommuter(route) {
  return (route || '').toLowerCase().startsWith('cr-')
}

function stationsFromLines(lines) {
  const byName = new Map()
  for (const line of lines) {
    for (const point of line.points ?? []) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue
      const key = (point.name || '').toLowerCase()
      if (!key) continue
      let station = byName.get(key)
      if (!station) {
        station = {
          name: point.name,
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

function projector(coords, paddingFrac = 0.05) {
  const points = coords.filter(
    (s) => Number.isFinite(s.lat) && Number.isFinite(s.lon),
  )
  if (points.length === 0) {
    return { width: 0, height: 0, project: () => ({ x: 0, y: 0 }) }
  }

  const lats = points.map((s) => s.lat)
  const lons = points.map((s) => s.lon)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const meanLat = (minLat + maxLat) / 2
  const lonScale = Math.cos((meanLat * Math.PI) / 180)

  const minX = minLon * lonScale
  const dataW = maxLon * lonScale - minX || 1
  const dataH = maxLat - minLat || 1
  const pad = Math.max(dataW, dataH) * paddingFrac
  const width = dataW + pad * 2
  const height = dataH + pad * 2

  return {
    width,
    height,
    project: (s) => ({
      x: pad + (s.lon * lonScale - minX),
      y: pad + (maxLat - s.lat),
    }),
  }
}

function nameKey(name) {
  return (name || '').toLowerCase()
}

function usablePoints(points) {
  return (points ?? []).filter(
    (p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon),
  )
}

function subpath(points, a, b) {
  const keys = points.map((p) => nameKey(p.name))
  const i = keys.indexOf(a)
  const j = keys.indexOf(b)
  if (i < 0 || j < 0 || i === j) return null
  return i < j ? points.slice(i, j + 1) : points.slice(j, i + 1).reverse()
}

// If another line stops at A…B with stations in between, follow that path
// so skip-stop CR does not cut the chord. Those extras are draw-only.
function threadCommuter(lines) {
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
      let detour = null
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

export function projectPlot(lines) {
  const stations = stationsFromLines(lines)
  const byName = new Map(stations.map((s) => [s.name.toLowerCase(), s]))
  const { width, height, project } = projector(stations)
  const drawn = threadCommuter(lines)
  const crFirst = (a, b) => Number(isCommuter(b.route)) - Number(isCommuter(a.route))

  const projectedLines = drawn.sort(crFirst).map((line) => ({
    ...line,
    points: line.points.map((p) => {
      const station = byName.get(nameKey(p.name))
      const coords = station ?? p
      return { ...p, lat: coords.lat, lon: coords.lon, ...project(coords) }
    }),
  }))

  const segmentsByRoute = new Map()
  for (const line of projectedLines) {
    if (!line.route || line.points.length < 2) continue
    const segs = segmentsByRoute.get(line.route) ?? []
    for (let i = 0; i < line.points.length - 1; i++) {
      const a = line.points[i]
      const b = line.points[i + 1]
      segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y })
    }
    segmentsByRoute.set(line.route, segs)
  }

  return {
    width,
    height,
    stations: stations.map((s) => ({ ...s, ...project(s) })),
    lines: projectedLines,
    project,
    segmentsByRoute,
  }
}

function nearestOnSegments(x, y, segments) {
  let bestX = x
  let bestY = y
  let best = Infinity
  for (const { ax, ay, bx, by } of segments) {
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
  return { x: bestX, y: bestY }
}

export function snapToRoute(x, y, route, segmentsByRoute) {
  const segments = segmentsByRoute.get(route)
  if (!segments?.length) return { x, y }
  return nearestOnSegments(x, y, segments)
}
