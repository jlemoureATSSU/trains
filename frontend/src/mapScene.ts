import type { Map as MaplibreMap, SkySpecification } from 'maplibre-gl'

const BUILDING_LAYER = 'mbta-3d-buildings'
const TERRAIN_SOURCE = 'mbta-terrain'

export type MapScene = {
  buildings: boolean
  labels: boolean
  terrain: boolean
}

function layoutVisibility(map: MaplibreMap, id: string) {
  try {
    return (map.getLayoutProperty(id, 'visibility') as string | undefined) ?? 'visible'
  } catch {
    return 'visible'
  }
}

function setVisibility(map: MaplibreMap, id: string, visible: boolean) {
  const next = visible ? 'visible' : 'none'
  if (layoutVisibility(map, id) === next) return
  map.setLayoutProperty(id, 'visibility', next)
}

function firstSymbolLayerId(map: MaplibreMap) {
  const layers = map.getStyle()?.layers ?? []
  return layers.find(
    (layer) =>
      layer.type === 'symbol' &&
      Boolean((layer.layout as { 'text-field'?: unknown } | undefined)?.['text-field']),
  )?.id
}

function buildingSource(map: MaplibreMap): { source: string; sourceLayer: string } | null {
  const sources = map.getStyle()?.sources ?? {}
  if (sources.openmaptiles) return { source: 'openmaptiles', sourceLayer: 'building' }
  if (sources['versatiles-shortbread']) {
    return { source: 'versatiles-shortbread', sourceLayer: 'buildings' }
  }
  return null
}

function applyLabels(map: MaplibreMap, show: boolean) {
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type === 'symbol') setVisibility(map, layer.id, show)
  }
}

function applyBuildings(map: MaplibreMap, enabled: boolean) {
  const layers = map.getStyle()?.layers ?? []

  for (const layer of layers) {
    const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined
    if (sourceLayer !== 'building' && sourceLayer !== 'buildings') continue
    if (layer.type === 'fill') setVisibility(map, layer.id, !enabled)
    if (layer.type === 'fill-extrusion' && layer.id !== BUILDING_LAYER) {
      setVisibility(map, layer.id, enabled)
    }
  }

  if (!enabled) {
    if (map.getLayer(BUILDING_LAYER)) map.removeLayer(BUILDING_LAYER)
    return
  }

  if (map.getLayer('building-3d') || map.getLayer(BUILDING_LAYER)) return

  const found = buildingSource(map)
  if (!found) return

  map.addLayer(
    {
      id: BUILDING_LAYER,
      type: 'fill-extrusion',
      source: found.source,
      'source-layer': found.sourceLayer,
      minzoom: 14,
      paint: {
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'render_height'], ['get', 'height'], 0],
          0,
          '#8a9098',
          80,
          '#c5ccd4',
        ],
        'fill-extrusion-height': [
          'coalesce',
          ['get', 'render_height'],
          ['get', 'height'],
          12,
        ],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.72,
      },
    },
    firstSymbolLayerId(map),
  )
}

function applyTerrain(map: MaplibreMap, enabled: boolean) {
  if (!enabled) {
    map.setTerrain(null)
    return
  }
  if (!map.getSource(TERRAIN_SOURCE)) {
    map.addSource(TERRAIN_SOURCE, {
      type: 'raster-dem',
      url: 'https://tiles.mapterhorn.com/tilejson.json',
    })
  }
  map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1.25 })
}

export function applyMapScene(map: MaplibreMap, scene: MapScene) {
  if (!map.isStyleLoaded()) return
  try {
    applyTerrain(map, scene.terrain)
    applyBuildings(map, scene.buildings)
    applyLabels(map, scene.labels)
  } catch {
    // Style swaps can race addLayer/addSource; the next idle pass retries.
  }
}

export const GLOBE_SKY: SkySpecification = {
  'sky-color': '#0b1220',
  'horizon-color': '#243044',
  'fog-color': '#1a2433',
  'fog-ground-blend': 0.45,
  'horizon-fog-blend': 0.55,
  'sky-horizon-blend': 0.75,
  'atmosphere-blend': [
    'interpolate',
    ['linear'],
    ['zoom'],
    2,
    0.85,
    8,
    0.18,
    12,
    0.04,
  ],
}
