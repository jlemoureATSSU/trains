import { useEffect, useMemo, useState } from 'react'
import { Layer, Map, Source, type LayerProps } from '@vis.gl/react-maplibre'
import { MAP_STYLES, MapControls, type MapStyleId } from '@/components/MapControls'
import { StationMark } from '@/components/StationMark'
import { VehicleMark } from '@/components/VehicleMark'
import { linesToGeoJSON, prepareMap, snapToRoute } from './geo'
import type { Line, Vehicle } from './types'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const BOSTON = {
  longitude: -71.0589,
  latitude: 42.3601,
  zoom: 11,
  pitch: 40,
  bearing: 0,
}

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

function App() {
  const [lines, setLines] = useState<Line[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [error, setError] = useState<string | null>(null)
  const [styleId, setStyleId] = useState<MapStyleId>('dark')
  const [viewState, setViewState] = useState(BOSTON)
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
      <div className="map-controls">
        <MapControls
          styleId={styleId}
          pitch={viewState.pitch}
          bearing={viewState.bearing}
          onStyleChange={setStyleId}
          onPitchChange={(pitch) => setViewState((view) => ({ ...view, pitch }))}
          onBearingChange={(bearing) =>
            setViewState((view) => ({ ...view, bearing }))
          }
          onReset={() =>
            setViewState((view) => ({
              ...view,
              pitch: BOSTON.pitch,
              bearing: BOSTON.bearing,
            }))
          }
        />
      </div>
      {error && <p className="status">Could not load lines: {error}</p>}
      {!error && lines.length === 0 && <p className="status">Loading…</p>}
      <div className="map">
        <Map
          {...viewState}
          onMove={(event) => setViewState(event.viewState)}
          mapStyle={MAP_STYLES[styleId].url}
          projection="globe"
          style={{ width: '100%', height: '100%' }}
        >
          {lineGeoJSON.features.length > 0 && (
            <Source id="mbta-lines" type="geojson" data={lineGeoJSON}>
              <Layer {...lineLayer} />
            </Source>
          )}
          {plot.stations.map((s) => (
            <StationMark key={s.name} station={s} />
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
