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

export type Point = {
  x: number
  y: number
}

export type MapStation = {
  name: string
  lat: number
  lon: number
  lines: string[]
  fromCr: boolean
}

export type PlottedStation = MapStation & Point

export type PlottedPoint = LinePoint & Point

export type PlottedLine = Omit<Line, 'points'> & {
  points: PlottedPoint[]
}

export type Segment = {
  ax: number
  ay: number
  bx: number
  by: number
}

export type Plot = {
  width: number
  height: number
  stations: PlottedStation[]
  lines: PlottedLine[]
  project: (point: LatLon) => Point
  segmentsByRoute: Map<string, Segment[]>
}
