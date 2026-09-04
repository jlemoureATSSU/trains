export type LinePoint = {
  name?: string
  lat: number
  lon: number
}

export type Line = {
  id: string
  route?: string
  color: string
  points: LinePoint[]
}

export type Stop = {
  id: string
  line?: string
  platform?: string
  vehicle_type?: number
  zone?: string
}

export type Station = {
  name: string
  lines: string[]
  lat?: number
  lon?: number
  stops: Stop[]
}

export type Vehicle = {
  id: string
  label?: string
  route?: string
  current_status?: string
  current_stop_sequence?: number
  direction_id?: number
  latitude?: number
  longitude?: number
  speed?: number
  carriages: number
  updated_at?: string
}

export type LatLon = {
  lat: number
  lon: number
}

export type NextStop = {
  name: string
  miles: number
  lat: number
  lon: number
}

export type LineNeighbors = {
  routes: string[]
  outbound: NextStop[]
  inbound: NextStop[]
}

export type MapStation = {
  name: string
  lat: number
  lon: number
  lines: string[]
  fromCr: boolean
  neighbors: LineNeighbors[]
}

export type Segment = {
  a: LatLon
  b: LatLon
}

export type Plot = {
  stations: MapStation[]
  lines: Line[]
  segmentsByRoute: Map<string, Segment[]>
  pointsByRoute: Map<string, LatLon[]>
  stopsByRoute: Map<string, { name: string; lat: number; lon: number }[][]>
}
