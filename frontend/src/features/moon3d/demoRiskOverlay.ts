/** Presentation fixtures only: categories and extent are not computed risk. */
export const DEMO_RISK_BANDS = {
  green: { color: '#38d995', symbol: '+', label: 'Green demo category' },
  orange: { color: '#ffac3d', symbol: '!', label: 'Orange demo category' },
  red: { color: '#ff5b70', symbol: 'x', label: 'Red demo category' },
} as const

// Explicit artwork assignments, not thresholds or a classification of fixture metrics.
const assignments: Record<string, keyof typeof DEMO_RISK_BANDS> = {
  shackleton: 'green', apollo11: 'green', malapert: 'green',
  apollo17: 'orange', change5: 'orange', aristarchus: 'orange', clavius: 'red',
}
export const demoBandForSite = (id: string) => {
  const category = assignments[id]
  return category ? DEMO_RISK_BANDS[category] : null
}

/** Decorative 8-degree cap around a preset; no measured spatial extent implied. */
export function demoPatchBoundary(latitude: number, longitude: number) {
  const radians = Math.PI / 180
  const lat = latitude * radians, lon = longitude * radians, radius = 8 * radians
  return Array.from({ length: 64 }, (_, index) => {
    const bearing = index / 64 * 2 * Math.PI
    const phi = Math.asin(Math.sin(lat) * Math.cos(radius) + Math.cos(lat) * Math.sin(radius) * Math.cos(bearing))
    const lambda = lon + Math.atan2(Math.sin(bearing) * Math.sin(radius) * Math.cos(lat), Math.cos(radius) - Math.sin(lat) * Math.sin(phi))
    return { latitude: phi / radians, longitude: lambda / radians }
  })
}

/** Clip projected decorative polygons to the visible hemisphere before drawing. */
export function clipDemoPatch(points: { screenX: number; screenY: number; z: number }[]) {
  const output: { screenX: number; screenY: number }[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    if (a.z >= 0) output.push(a)
    if ((a.z >= 0) !== (b.z >= 0)) {
      const t = a.z / (a.z - b.z)
      output.push({ screenX: a.screenX + t * (b.screenX - a.screenX), screenY: a.screenY + t * (b.screenY - a.screenY) })
    }
  }
  return output.map(p => `${p.screenX},${p.screenY}`).join(' ')
}
