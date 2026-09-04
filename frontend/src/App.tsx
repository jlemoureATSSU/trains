import { useEffect, useMemo, useRef, useState } from 'react'
import { Layer, Map, Source, type LayerProps, type MapRef } from '@vis.gl/react-maplibre'
import { MAP_STYLES, MapControls, LINE_MODES, type LineMode, type MapStyleId } from '@/components/MapControls'
import { StationMark } from '@/components/StationMark'
import { VehicleMark } from '@/components/VehicleMark'
import { linesToGeoJSON, lineLabelsToGeoJSON, prepareMap } from './geo'
import { applyMapScene } from './mapScene'
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

const lineNames: LayerProps = {
  id: 'mbta-line-labels',
  type: 'symbol',
  minzoom: 11,
  layout: {
    'symbol-placement': 'line-center',
    'symbol-spacing': 1,
    'text-field': ['get', 'name'],
    'text-size': [
      'interpolate',
      ['linear'],
      ['zoom'],
      11,
      11,
      14,
      13,
      16,
      15,
    ],
    'text-font': ['Noto Sans Regular'],
    'text-letter-spacing': 0.14,
    'text-transform': 'uppercase',
    'text-max-angle': 35,
    'text-padding': 2,
    'text-anchor': 'center',
    'text-keep-upright': true,
    'text-optional': true,
    'symbol-sort-key': ['-', 1, ['get', 'commuter']],
    'text-allow-overlap': false,
    'text-ignore-placement': false,
  },
  paint: {
    'text-color': '#ffffff',
    'text-halo-color': ['get', 'color'],
    'text-halo-width': 2.4,
    'text-halo-blur': 0.15,
    'text-opacity': 0.96,
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
  const [terrain, setTerrain] = useState(false)
  const [buildings, setBuildings] = useState(false)
  const [labels, setLabels] = useState(true)
  const [lineMode, setLineMode] = useState<LineMode>('all')
  const [viewState, setViewState] = useState(BOSTON)
  const routeTypes = LINE_MODES[lineMode].routeTypes
  const plot = useMemo(() => prepareMap(lines), [lines])
  const lineGeoJSON = useMemo(() => linesToGeoJSON(plot.lines), [plot.lines])
  const lineLabelGeoJSON = useMemo(
    () => lineLabelsToGeoJSON(plot.lines),
    [plot.lines],
  )
  const scene = useMemo(
    () => ({ buildings, labels, terrain }),
    [buildings, labels, terrain],
  )

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (map) applyMapScene(map, scene)
  }, [scene, styleId])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/lines?route_type=${routeTypes}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json() as Promise<Line[]>
      })
      .then((data) => {
        if (!cancelled) {
          setLines(data)
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [routeTypes])

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch(`${API_BASE}/vehicles?route_type=${routeTypes}`)
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
  }, [routeTypes])

  return (
    <main className="page">
      <div className="map-controls">
        <MapControls
          styleId={styleId}
          pitch={viewState.pitch}
          bearing={viewState.bearing}
          onStyleChange={setStyleId}
          terrain={terrain}
          buildings={buildings}
          labels={labels}
          lineMode={lineMode}
          onTerrainChange={setTerrain}
          onBuildingsChange={setBuildings}
          onLabelsChange={setLabels}
          onLineModeChange={setLineMode}
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
          canvasContextAttributes={{ antialias: true }}
          style={{ width: '100%', height: '100%' }}
        >
          {lineGeoJSON.features.length > 0 && (
            <Source id="mbta-lines" type="geojson" data={lineGeoJSON}>
              <Layer {...lineGlow} />
              <Layer {...lineCore} />
            </Source>
          )}
          {lineLabelGeoJSON.features.length > 0 && (
            <Source id="mbta-line-labels" type="geojson" data={lineLabelGeoJSON}>
              <Layer {...lineNames} />
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
