import { useEffect, useMemo, useState } from 'react'
import { Layer, Map, Marker, Source, type LayerProps } from '@vis.gl/react-maplibre'
import { LINE_COLORS, darken, routeColor, stationColors } from './colors'
import { linesToGeoJSON, prepareMap, snapToRoute } from './geo'
import type { LatLon, Line, MapStation, Vehicle } from './types'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark'
const BOSTON = { longitude: -71.0589, latitude: 42.3601, zoom: 11 }

const lineLayer: LayerProps = {
  id: 'mbta-lines',
  type: 'line',
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
    'line-sort-key': ['-', 1, ['get', 'commuter']],
  },
  paint: {
    'line-color': ['get', 'color'],
    'line-width': [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      ['case', ['==', ['get', 'commuter'], 1], 1.2, 2.2],
      14,
      ['case', ['==', ['get', 'commuter'], 1], 2.5, 4],
    ],
    'line-opacity': 0.92,
  },
}

function StationDot({ station }: { station: MapStation }) {
  const colors = stationColors(station.lines)
  if (colors.length === 0) return null

  const rings = colors.length - 1
  const r = 3.5 + rings * 2.5
  const size = (r + 1.75) * 2

  return (
    <Marker longitude={station.lon} latitude={station.lat} anchor="center">
      <svg
        className="station"
        width={size}
        height={size}
        viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      >
        <title>{station.name}</title>
        {[...colors].reverse().map((key, i) => {
          const innermost = i === colors.length - 1
          const ring = colors.length - 1 - i
          return (
            <circle
              key={key}
              cx={0}
              cy={0}
              r={3.5 + ring * 2.5}
              fill={innermost ? LINE_COLORS[key] : 'none'}
              stroke={innermost ? 'none' : LINE_COLORS[key]}
              strokeWidth={innermost ? 0 : 1.75}
            />
          )
        })}
      </svg>
    </Marker>
  )
}

function VehicleMark({ vehicle }: { vehicle: Vehicle & LatLon }) {
  const color = routeColor(vehicle.route)
  return (
    <Marker longitude={vehicle.lon} latitude={vehicle.lat} anchor="center">
      <svg className="vehicle" width="14" height="14" viewBox="-7 -7 14 14">
        <title>
          {vehicle.label || vehicle.id}
          {vehicle.route ? ` · ${vehicle.route}` : ''}
        </title>
        <polygon
          points="0,-5.5 4.8,2.8 -4.8,2.8"
          fill={color}
          stroke={darken(color)}
          strokeLinejoin="round"
          strokeWidth="1.2"
        />
      </svg>
    </Marker>
  )
}

function App() {
  const [lines, setLines] = useState<Line[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [error, setError] = useState<string | null>(null)
  const plot = useMemo(() => prepareMap(lines), [lines])
  const lineGeoJSON = useMemo(() => linesToGeoJSON(plot.lines), [plot.lines])

  useEffect(() => {
    fetch(`${API_BASE}/lines`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<Line[]>
      })
      .then(setLines)
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch(`${API_BASE}/vehicles?route_type=0,1,2`)
        .then((res) => {
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
          return res.json() as Promise<Vehicle[]>
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

  const vehicleMarks = useMemo(
    () =>
      vehicles
        .filter(
          (v): v is Vehicle & { latitude: number; longitude: number } =>
            Number.isFinite(v.latitude) && Number.isFinite(v.longitude),
        )
        .map((v) => {
          const pos = snapToRoute(
            { lat: v.latitude, lon: v.longitude },
            v.route,
            plot.segmentsByRoute,
          )
          return { ...v, ...pos }
        }),
    [vehicles, plot.segmentsByRoute],
  )

  return (
    <main className="page">
      {error && <p className="status">Could not load lines: {error}</p>}
      {!error && lines.length === 0 && <p className="status">Loading…</p>}
      <div className="map">
        <Map
          initialViewState={BOSTON}
          mapStyle={MAP_STYLE}
          projection="globe"
          pitch={40}
          bearing={0}
          style={{ width: '100%', height: '100%' }}
        >
          {lineGeoJSON.features.length > 0 && (
            <Source id="mbta-lines" type="geojson" data={lineGeoJSON}>
              <Layer {...lineLayer} />
            </Source>
          )}
          {plot.stations.map((s) => (
            <StationDot key={s.name} station={s} />
          ))}
          {vehicleMarks.map((v) => (
            <VehicleMark key={v.id} vehicle={v} />
          ))}
        </Map>
      </div>
    </main>
  )
}

export default App
