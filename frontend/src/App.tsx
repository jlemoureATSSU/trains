import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Layer, Map, Source, type MapRef } from '@vis.gl/react-maplibre'
import { MAP_STYLES, MapControls, LINE_MODES, type LineMode, type MapStyleId } from '@/components/MapControls'
import { StationMark } from '@/components/StationMark'
import { VehicleMark } from '@/components/VehicleMark'
import { linesToGeoJSON, lineLabelsToGeoJSON, headingToStop, prepareMap, snapToRoute } from './geo'
import { applyMapScene } from './mapScene'
import type { LatLon, Line, Vehicle } from './types'
import { useVehicleMotion, VEHICLE_POLL_MS, VEHICLE_SLIDE_MS } from './useVehicleMotion'
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
const STATION_FOCUS_MS = 1100
const STATION_FOCUS_ZOOM = 15

const lineLayout = {
  'line-cap': 'round' as const,
  'line-join': 'round' as const,
  'line-sort-key': ['-', 1, ['get', 'commuter']] as [
    '-',
    number,
    ['get', string],
  ],
}

const lineGlowPaint = {
  'line-color': ['get', 'color'] as ['get', string],
  'line-width': [
    'interpolate',
    ['linear'],
    ['zoom'],
    8,
    ['case', ['==', ['get', 'commuter'], 1], 5, 8],
    14,
    ['case', ['==', ['get', 'commuter'], 1], 10, 16],
  ] as [
    'interpolate',
    ['linear'],
    ['zoom'],
    number,
    ['case', ['==', ['get', string], number], number, number],
    number,
    ['case', ['==', ['get', string], number], number, number],
  ],
  'line-blur': [
    'interpolate',
    ['linear'],
    ['zoom'],
    8,
    3.5,
    14,
    7,
  ] as ['interpolate', ['linear'], ['zoom'], number, number, number, number],
  'line-opacity': 0.38,
}

const lineCorePaint = {
  'line-color': ['get', 'color'] as ['get', string],
  'line-width': [
    'interpolate',
    ['linear'],
    ['zoom'],
    8,
    ['case', ['==', ['get', 'commuter'], 1], 1.4, 2.4],
    14,
    ['case', ['==', ['get', 'commuter'], 1], 2.6, 4.2],
  ] as [
    'interpolate',
    ['linear'],
    ['zoom'],
    number,
    ['case', ['==', ['get', string], number], number, number],
    number,
    ['case', ['==', ['get', string], number], number, number],
  ],
  'line-opacity': 0.96,
}

const lineNamesLayout = {
  'symbol-placement': 'line-center' as const,
  'symbol-spacing': 1,
  'text-field': ['get', 'name'] as ['get', string],
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
  ] as [
    'interpolate',
    ['linear'],
    ['zoom'],
    number,
    number,
    number,
    number,
    number,
    number,
  ],
  'text-font': ['Noto Sans Regular'],
  'text-letter-spacing': 0.14,
  'text-transform': 'uppercase' as const,
  'text-max-angle': 35,
  'text-padding': 8,
  'text-anchor': 'center' as const,
  'text-keep-upright': true,
  'text-optional': true,
  'symbol-sort-key': ['-', 1, ['get', 'commuter']] as [
    '-',
    number,
    ['get', string],
  ],
  'text-allow-overlap': false,
  'text-ignore-placement': false,
}

const lineNamesPaint = {
  'text-color': '#ffffff',
  'text-halo-color': ['get', 'color'] as ['get', string],
  'text-halo-width': 2.4,
  'text-halo-blur': 0.15,
  'text-opacity': 0.96,
}

function dimOpacity(highlighted: string | null, on: number, off: number) {
  if (!highlighted) return on
  return [
    'case',
    ['==', ['get', 'route'], highlighted],
    on,
    off,
  ] as ['case', ['==', ['get', string], string], number, number]
}

function VehicleLayer({
  mapRef,
  vehicles,
  plot,
  highlightedRoute,
  focusedId,
  anyFocused,
  flying,
  onDismissFocus,
  onGoToVehicle,
  onGoToStation,
}: {
  mapRef: RefObject<MapRef | null>
  vehicles: Vehicle[]
  plot: ReturnType<typeof prepareMap>
  highlightedRoute: string | null
  focusedId: string | null
  anyFocused: boolean
  flying: boolean
  onDismissFocus: () => void
  onGoToVehicle: (vehicle: Vehicle) => void
  onGoToStation: (stop: { name: string; lat: number; lon: number }) => void
}) {
  const marks = useVehicleMotion(vehicles, plot)
  const followed = focusedId
    ? marks.find((vehicle) => vehicle.id === focusedId)
    : undefined
  const followKey = followed
    ? `${followed.id}:${followed.lat}:${followed.lon}`
    : null
  const lastFollow = useRef<string | null>(null)

  useEffect(() => {
    if (focusedId && !flying && !followed) onDismissFocus()
  }, [focusedId, flying, followed, onDismissFocus])

  useEffect(() => {
    if (!followKey) {
      lastFollow.current = null
      return
    }
    if (!followed || flying) return
    const prev = lastFollow.current
    lastFollow.current = followKey
    if (!prev || prev.split(':')[0] !== followed.id) return
    if (prev === followKey) return
    if (!followed.slide) return
    mapRef.current?.easeTo({
      center: [followed.lon, followed.lat],
      offset: [0, 80],
      duration: VEHICLE_SLIDE_MS,
    })
  }, [followed, followKey, flying, mapRef])

  return (
    <>
      {marks.map((v) => (
        <VehicleMark
          key={v.id}
          vehicle={v}
          heading={v.heading}
          slide={v.slide}
          dimmed={Boolean(highlightedRoute && v.route !== highlightedRoute)}
          focused={focusedId === v.id}
          anyFocused={anyFocused}
          onDismissFocus={onDismissFocus}
          onGoToVehicle={onGoToVehicle}
          onGoToStation={onGoToStation}
          nextStop={headingToStop(
            v,
            v.route,
            v.direction_id,
            v.current_status,
            plot.stopsByRoute,
          )}
        />
      ))}
    </>
  )
}

function App() {
  const mapRef = useRef<MapRef>(null)
  const stationFlight = useRef(0)
  const [lines, setLines] = useState<Line[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [error, setError] = useState<string | null>(null)
  const [styleId, setStyleId] = useState<MapStyleId>('dark')
  const [terrain, setTerrain] = useState(false)
  const [buildings, setBuildings] = useState(false)
  const [labels, setLabels] = useState(true)
  const [lineMode, setLineMode] = useState<LineMode>('all')
  const [highlightedRoute, setHighlightedRoute] = useState<string | null>(null)
  const [focusedStation, setFocusedStation] = useState<string | null>(null)
  const [focusedVehicle, setFocusedVehicle] = useState<string | null>(null)
  const [flyingToStation, setFlyingToStation] = useState(false)
  const anyFocused = Boolean(focusedStation) || Boolean(focusedVehicle) || flyingToStation
  const [viewState, setViewState] = useState(BOSTON)
  const routeTypes = LINE_MODES[lineMode].routeTypes
  const plot = useMemo(() => prepareMap(lines), [lines])
  const vehiclesById = useMemo(() => {
    const byId: Record<string, Vehicle> = {}
    for (const vehicle of vehicles) byId[vehicle.id] = vehicle
    return byId
  }, [vehicles])
  const dimRoute =
    (focusedVehicle ? vehiclesById[focusedVehicle]?.route : undefined) ??
    highlightedRoute ??
    null
  const lineGeoJSON = useMemo(() => linesToGeoJSON(plot.lines), [plot.lines])
  const lineLabelGeoJSON = useMemo(
    () => lineLabelsToGeoJSON(plot.lines),
    [plot.lines],
  )
  const scene = useMemo(
    () => ({ buildings, labels, terrain }),
    [buildings, labels, terrain],
  )

  function goToStation(stop: { name: string; lat: number; lon: number }) {
    const station =
      plot.stations.find(
        (candidate) => candidate.name.toLowerCase() === stop.name.toLowerCase(),
      ) ?? stop
    const camera = mapRef.current
    const id = ++stationFlight.current
    setFocusedStation(null)
    setFocusedVehicle(null)
    setFlyingToStation(true)
    if (!camera) {
      setFlyingToStation(false)
      setFocusedStation(station.name)
      return
    }
    camera.easeTo({
      center: [station.lon, station.lat],
      zoom: STATION_FOCUS_ZOOM,
      offset: [0, 80],
      duration: STATION_FOCUS_MS,
    })
    camera.getMap().once('moveend', () => {
      if (stationFlight.current !== id) return
      setFlyingToStation(false)
      setFocusedStation(station.name)
    })
  }

  function goToVehicle(vehicle: Vehicle) {
    if (!Number.isFinite(vehicle.latitude) || !Number.isFinite(vehicle.longitude)) {
      return
    }
    const point: LatLon = snapToRoute(
      { lat: vehicle.latitude as number, lon: vehicle.longitude as number },
      vehicle.route,
      plot.segmentsByRoute,
    )
    const camera = mapRef.current
    const id = ++stationFlight.current
    setFocusedStation(null)
    setFocusedVehicle(null)
    setFlyingToStation(true)
    if (!camera) {
      setFlyingToStation(false)
      setFocusedVehicle(vehicle.id)
      return
    }
    camera.easeTo({
      center: [point.lon, point.lat],
      zoom: STATION_FOCUS_ZOOM,
      offset: [0, 80],
      duration: STATION_FOCUS_MS,
    })
    camera.getMap().once('moveend', () => {
      if (stationFlight.current !== id) return
      setFlyingToStation(false)
      setFocusedVehicle(vehicle.id)
    })
  }

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
          onLineModeChange={(mode) => {
            setLineMode(mode)
            setHighlightedRoute(null)
            stationFlight.current += 1
            setFlyingToStation(false)
            setFocusedStation(null)
            setFocusedVehicle(null)
          }}
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
          onResetLocation={() => {
            stationFlight.current += 1
            setFlyingToStation(false)
            setFocusedStation(null)
            setFocusedVehicle(null)
            mapRef.current?.easeTo({
              center: [BOSTON.longitude, BOSTON.latitude],
              zoom: BOSTON.zoom,
              duration: RESET_CAMERA_MS,
            })
          }}
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
          interactiveLayerIds={['mbta-line-labels']}
          onMouseMove={(event) => {
            const overLabel = event.features?.some(
              (feature) => feature.layer?.id === 'mbta-line-labels',
            )
            event.target.getCanvas().style.cursor = overLabel ? 'pointer' : ''
          }}
          onMouseLeave={(event) => {
            event.target.getCanvas().style.cursor = ''
          }}
          onClick={(event) => {
            const route = event.features?.find(
              (feature) => feature.layer?.id === 'mbta-line-labels',
            )?.properties?.route
            if (typeof route === 'string' && route) {
              setHighlightedRoute((current) => (current === route ? null : route))
              return
            }
            setHighlightedRoute(null)
            stationFlight.current += 1
            setFlyingToStation(false)
            setFocusedStation(null)
            setFocusedVehicle(null)
          }}
          mapStyle={MAP_STYLES[styleId].url}
          canvasContextAttributes={{ antialias: true }}
          style={{ width: '100%', height: '100%' }}
        >
          {lineGeoJSON.features.length > 0 && (
            <Source id="mbta-lines" type="geojson" data={lineGeoJSON}>
              <Layer
                id="mbta-lines-glow"
                type="line"
                layout={lineLayout}
                paint={{
                  ...lineGlowPaint,
                  'line-opacity': dimOpacity(dimRoute, 0.38, 0.06),
                }}
              />
              <Layer
                id="mbta-lines"
                type="line"
                layout={lineLayout}
                paint={{
                  ...lineCorePaint,
                  'line-opacity': dimOpacity(dimRoute, 0.96, 0.12),
                }}
              />
            </Source>
          )}
          {lineLabelGeoJSON.features.length > 0 && (
            <Source id="mbta-line-labels" type="geojson" data={lineLabelGeoJSON}>
              <Layer
                id="mbta-line-labels"
                type="symbol"
                minzoom={11}
                layout={lineNamesLayout}
                paint={{
                  ...lineNamesPaint,
                  'text-opacity': dimOpacity(dimRoute, 0.96, 0.14),
                }}
              />
            </Source>
          )}
          {plot.stations.map((s) => (
            <StationMark
              key={s.name}
              station={s}
              highlightedRoute={dimRoute}
              focused={focusedStation === s.name}
              anyFocused={anyFocused}
              onHighlightRoute={(route) =>
                setHighlightedRoute((current) =>
                  current === route ? null : route,
                )
              }
              onDismissFocus={() => setFocusedStation(null)}
              onGoToStation={goToStation}
              vehiclesById={vehiclesById}
              onGoToVehicle={goToVehicle}
            />
          ))}
          <VehicleLayer
            mapRef={mapRef}
            vehicles={vehicles}
            plot={plot}
            highlightedRoute={dimRoute}
            focusedId={focusedVehicle}
            anyFocused={anyFocused}
            flying={flyingToStation}
            onDismissFocus={() => setFocusedVehicle(null)}
            onGoToVehicle={goToVehicle}
            onGoToStation={goToStation}
          />
        </Map>
      </div>
    </main>
  )
}

export default App
