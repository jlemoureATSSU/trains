export function routeBadge(route?: string) {
  if (!route) return '?'
  if (route.startsWith('Green-')) return route.slice(6)
  if (route.startsWith('CR-')) {
    const branch = route.slice(3).replaceAll('-', ' ')
    return branch.length <= 6 ? branch : `${branch.slice(0, 5)}.`
  }
  if (/mattapan/i.test(route)) return 'M'
  if (/red/i.test(route)) return 'RL'
  if (/orange/i.test(route)) return 'OL'
  if (/blue/i.test(route)) return 'BL'
  return route.slice(0, 2).toUpperCase()
}

export function routeTitle(route?: string) {
  if (!route) return 'Unknown route'
  if (route.startsWith('CR-')) return route.slice(3).replaceAll('-', ' ')
  if (route.startsWith('Green-')) return `Green ${route.slice(6)}`
  return route
}

export function lineLabel(route?: string) {
  if (!route) return ''
  if (route.startsWith('Green-')) return `Green ${route.slice(6)}`
  if (route.startsWith('CR-')) return route.slice(3).replaceAll('-', ' ')
  if (/mattapan/i.test(route)) return 'Mattapan'
  return route
}

export function isCommuterRoute(route?: string) {
  return (route || '').toLowerCase().startsWith('cr-')
}
