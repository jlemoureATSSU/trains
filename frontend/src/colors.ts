export type SubwayColor = 'green' | 'orange' | 'red' | 'blue'
export type LineColor = SubwayColor | 'purple'

export const LINE_COLORS: Record<LineColor, string> = {
  green: '#00843D',
  orange: '#ED8B00',
  red: '#DA291C',
  blue: '#003DA5',
  purple: '#80276C',
}

const RING_ORDER: SubwayColor[] = ['green', 'orange', 'red', 'blue']

function colorKey(line: string | null | undefined): LineColor | null {
  const name = (line || '').toLowerCase()
  if (name.startsWith('cr-') || name.includes('commuter')) return 'purple'
  if (name.includes('green')) return 'green'
  if (name.includes('orange')) return 'orange'
  if (name.includes('red') || name.includes('mattapan')) return 'red'
  if (name.includes('blue')) return 'blue'
  return null
}

export function routeColor(route: string | null | undefined): string {
  const key = colorKey(route)
  return key ? LINE_COLORS[key] : '#888888'
}

export function darken(hex: string, amount = 0.45): string {
  const n = hex.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  const to = (c: number) =>
    Math.round(c * (1 - amount))
      .toString(16)
      .padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

export function stationColors(lines: string[] | undefined): LineColor[] {
  const keys = new Set<SubwayColor>()
  let commuter = false
  for (const line of lines ?? []) {
    const key = colorKey(line)
    if (key === 'purple') commuter = true
    else if (key) keys.add(key)
  }
  const subway = RING_ORDER.filter((key) => keys.has(key))
  if (subway.length && commuter) return [...subway, 'purple']
  if (subway.length) return subway
  if (commuter) return ['purple']
  return []
}
