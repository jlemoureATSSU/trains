import { useEffect, useState } from 'react'
import { LINE_COLORS, darken, routeColor, stationColors } from './colors'
import { projectPlot, snapToRoute } from './geo'
import { usePanZoom } from './usePanZoom'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL

function StationDot({ station }) {
  const colors = stationColors(station.lines)
  if (colors.length === 0) return null

  return (
    <g>
      <title>{station.name}</title>
      {[...colors].reverse().map((key, i) => {
        const innermost = i === colors.length - 1
        return (
          <circle
            key={key}
            className={`dot dot--${colors.length - 1 - i}`}
            cx={station.x}
            cy={station.y}
            fill={innermost ? LINE_COLORS[key] : 'none'}
            stroke={innermost ? 'none' : LINE_COLORS[key]}
          />
        )
      })}
    </g>
  )
}

function VehicleMark({ vehicle }) {
  const color = routeColor(vehicle.route)
  return (
    <g transform={`translate(${vehicle.x} ${vehicle.y})`}>
      <title>
        {vehicle.label || vehicle.id}
        {vehicle.route ? ` · ${vehicle.route}` : ''}
      </title>
      <polygon
        className="vehicle"
        points="0,-1 0.866,0.5 -0.866,0.5"
        fill={color}
        stroke={darken(color)}
      />
    </g>
  )
}

function App() {
  const [lines, setLines] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [error, setError] = useState(null)
  const plot = projectPlot(lines)
  const { ref, view, panning, onPointerDown, onPointerMove, onPointerUp } =
    usePanZoom(plot.width, plot.height)

  useEffect(() => {
    fetch(`${API_BASE}/lines`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json()
      })
      .then(setLines)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch(`${API_BASE}/vehicles?route_type=0,1,2`)
        .then((res) => {
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
          return res.json()
        })
        .then((data) => {
          if (!cancelled) setVehicles(data)
        })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const vehicleMarks = vehicles
    .filter((v) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude))
    .map((v) => {
      const pos = plot.project({ lat: v.latitude, lon: v.longitude })
      return {
        ...v,
        ...snapToRoute(pos.x, pos.y, v.route, plot.segmentsByRoute),
      }
    })

  return (
    <main className="page">
      {error && <p className="status">Could not load lines: {error}</p>}
      {!error && lines.length === 0 && <p className="status">Loading…</p>}
      {plot.stations.length > 0 && (
        <svg
          ref={ref}
          className={`plot${panning ? ' is-panning' : ''}`}
          viewBox={`0 0 ${plot.width} ${plot.height}`}
          role="img"
          aria-label="MBTA lines and stops"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {plot.lines.map((line) => (
              <polyline
                key={line.id}
                className="line"
                points={line.points.map((p) => `${p.x},${p.y}`).join(' ')}
                stroke={line.color}
              />
            ))}
            {plot.stations.map((s) => (
              <StationDot key={s.name} station={s} />
            ))}
            {vehicleMarks.map((v) => (
              <VehicleMark key={v.id} vehicle={v} />
            ))}
          </g>
        </svg>
      )}
    </main>
  )
}

export default App
