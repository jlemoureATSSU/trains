import { useEffect, useMemo, useRef, useState } from 'react'
import { Layer, Map, Source, type LayerProps, type MapRef } from '@vis.gl/react-maplibre'
import { MAP_STYLES, MapControls, type MapStyleId } from '@/components/MapControls'
import { StationMark } from '@/components/StationMark'
import { VehicleMark } from '@/components/VehicleMark'
import { linesToGeoJSON, prepareMap } from './geo'
import { applyMapScene, GLOBE_SKY } from './mapScene'
import type { Line, Vehicle } from './types'
import { useVehicleMotion, VEHICLE_POLL_MS } from './useVehicleMotion'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const BOSTON = {
  longitude: -71.0589,
  latitude: 42.3601,
  zoom: 13,
  pitch: 40,
  bearing: 0,
}
const RESET_CAMERA_MS = 1000

const lineLayout = {
  'line-cap': 'round' as const,
  'line-join': 'round' as const,
  'line-sort-key': ['-', 1, ['get', 'commuter']] as [
    '-',
    number,
    ['get', string],
  ],
}

const lineGlow: LayerProps = {
  id: 'mbta-lines-glow',
  type: 'line',
  layout: lineLayout,
  paint: {
    'line-color': ['get', 'color'],
    'line-width': [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      ['case', ['==', ['get', 'commuter'], 1], 5, 8],
      14,
      ['case', ['==', ['get', 'commuter'], 1], 10, 16],
    ],
    'line-blur': [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      3.5,
      14,
      7,
    ],
    'line-opacity': 0.38,
  },
}

const lineCore: LayerProps = {
  id: 'mbta-lines',
  type: 'line',
  layout: lineLayout,
  paint: {
    'line-color': ['get', 'color'],
    'line-width': [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      ['case', ['==', ['get', 'commuter'], 1], 1.4, 2.4],
      14,
      ['case', ['==', ['get', 'commuter'], 1], 2.6, 4.2],
    ],
    'line-opacity': 0.96,
  },
}

function VehicleLayer({
  vehicles,
  plot,
}: {
  vehicles: Vehicle[]
  plot: ReturnType<typeof prepareMap>
}) {
  const marks = useVehicleMotion(vehicles, plot)
  return (
    <>
      {marks.map((v) => (
        <VehicleMark key={v.id} vehicle={v} heading={v.heading} />
      ))}
    </>
  )
}

function App() {
  const mapRef = useRef<MapRef>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [error, setError] = useState<string | null>(null)
  const [styleId, setStyleId] = useState<MapStyleId>('dark')
  const [globe, setGlobe] = useState(true)
  const [terrain, setTerrain] = useState(false)
  const [buildings, setBuildings] = useState(false)
  const [labels, setLabels] = useState(true)
  const [viewState, setViewState] = useState(BOSTON)
  const plot = useMemo(() => prepareMap(lines), [lines])
  const lineGeoJSON = useMemo(() => linesToGeoJSON(plot.lines), [plot.lines])
  const scene = useMemo(
    () => ({ buildings, labels, terrain }),
    [buildings, labels, terrain],
  )

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (map) applyMapScene(map, scene)
  }, [scene, styleId])

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
    const id = setInterval(load, VEHICLE_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <main className="page">
      <div className="map-controls">
        <MapControls
          styleId={styleId}
          pitch={viewState.pitch}
          bearing={viewState.bearing}
          onStyleChange={setStyleId}
          globe={globe}
          terrain={terrain}
          buildings={buildings}
          labels={labels}
          onGlobeChange={setGlobe}
          onTerrainChange={setTerrain}
          onBuildingsChange={setBuildings}
          onLabelsChange={setLabels}
          onPitchChange={(pitch) => setViewState((view) => ({ ...view, pitch }))}
          onBearingChange={(bearing) =>
            setViewState((view) => ({ ...view, bearing }))
          }
          onReset={() =>
            mapRef.current?.easeTo({
              pitch: BOSTON.pitch,
              bearing: BOSTON.bearing,
              duration: RESET_CAMERA_MS,
            })
          }
          onResetLocation={() =>
            mapRef.current?.easeTo({
              center: [BOSTON.longitude, BOSTON.latitude],
              zoom: BOSTON.zoom,
              duration: RESET_CAMERA_MS,
            })
          }
        />
      </div>
      {error && <p className="status">Could not load lines: {error}</p>}
      {!error && lines.length === 0 && <p className="status">Loading…</p>}
      <div className="map">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(event) => setViewState(event.viewState)}
          onIdle={(event) => applyMapScene(event.target, scene)}
          mapStyle={MAP_STYLES[styleId].url}
          projection={globe ? 'globe' : 'mercator'}
          sky={globe ? GLOBE_SKY : undefined}
          canvasContextAttributes={{ antialias: true }}
          style={{ width: '100%', height: '100%' }}
        >
          {lineGeoJSON.features.length > 0 && (
            <Source id="mbta-lines" type="geojson" data={lineGeoJSON}>
              <Layer {...lineGlow} />
              <Layer {...lineCore} />
            </Source>
          )}
          {plot.stations.map((s) => (
            <StationMark key={s.name} station={s} />
          ))}
          <VehicleLayer vehicles={vehicles} plot={plot} />
        </Map>
      </div>
    </main>
  )
}

export default App
