import { API_BASE_URL } from './analysis'

export interface GeographicPoint { latitude: number; longitude: number }
export interface NativeBounds { min_x: number; min_y: number; max_x: number; max_y: number }
export interface TerrainMetric { value: number | null; unit: 'm' | 'degree'; status: 'available' | 'nodata' | 'unverified' }
export interface Site04Cell {
  row: number; column: number; bounds: NativeBounds; center: GeographicPoint | null
  elevation: TerrainMetric; slope: TerrainMetric
  elevation_rms_uncertainty: TerrainMetric; slope_rms_uncertainty: TerrainMetric
  observation_status: 'observed' | 'unobserved' | 'nodata' | 'unverified'
}
export interface Site04Terrain {
  schema_version: '1.0'; site_id: 'Site04'; status: 'provisional' | 'unavailable'; detail: string
  cells: Site04Cell[]; returned_bounds: NativeBounds | null
  returned_resolution: { x_spacing: number; y_spacing: number; units: string; rows: number; columns: number } | null
  selection: { requested: GeographicPoint; nearest_cell: GeographicPoint; row: number; column: number } | null
  sources: { product: string; url: string; sha256: string; bytes: number }[]
  elevation_reference: string | null; mapping_status: string | null; limitations: string[]
}
export interface Site04Footprint {
  frame: string; projected_bounds: NativeBounds; center: GeographicPoint
  boundary: GeographicPoint[]; limitation: string
}

/** Inverse of the inspected spherical south-polar CRS; no Earth EPSG transform. */
export function site04ToGeographic(x: number, y: number): GeographicPoint {
  return { latitude: -90+2*Math.atan2(Math.hypot(x,y),2*1737400)*180/Math.PI, longitude: Math.atan2(x,y)*180/Math.PI }
}

async function read(path: string, signal: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/terrain/site04/${path}`, { signal })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('Could not reach the Site04 service. Check the connection and retry.')
  }
  if (!response.ok) {
    if (response.status === 404) throw new Error('The connected backend does not serve this Site04 route (HTTP 404). It needs a newer deployment.')
    if (response.status === 422) {
      const body = await response.json().catch(() => null)
      if (body?.detail?.code === 'OUTSIDE_SITE04_COVERAGE') throw new Error('This point is outside the Site04 source footprint.')
      throw new Error('The backend rejected these Site04 coordinates (HTTP 422).')
    }
    throw new Error(`Site04 request failed (HTTP ${response.status}).`)
  }
  return response.json().catch(error => {
    if (signal.aborted) throw error
    throw new Error('The Site04 service returned unreadable data.')
  })
}

export async function fetchSite04Terrain(point: GeographicPoint | null, signal: AbortSignal): Promise<Site04Terrain> {
  const query = point ? `?${new URLSearchParams({latitude:String(point.latitude),longitude:String(point.longitude),width:'32'})}` : ''
  const value = await read(`grid${query}`, signal) as Site04Terrain
  if (!value || !['provisional','unavailable'].includes(value.status) || !Array.isArray(value.cells) || value.cells.length > 1024 || !Array.isArray(value.sources) || !Array.isArray(value.limitations)) throw new Error('Invalid Site04 terrain response.')
  if (value.status === 'provisional' && (!value.returned_bounds || !value.returned_resolution || !value.cells.length)) throw new Error('Site04 terrain window is incomplete.')
  if (point && value.status === 'provisional' && (!value.selection
    || value.selection.requested.latitude !== point.latitude || value.selection.requested.longitude !== point.longitude)) {
    throw new Error('The Site04 window does not match the requested coordinates.')
  }
  for (const cell of value.cells) {
    if (!cell.bounds || !Object.values(cell.bounds).every(Number.isFinite)) throw new Error('Invalid terrain cell bounds.')
    for (const key of ['elevation','slope','elevation_rms_uncertainty','slope_rms_uncertainty'] as const) {
      const metric = cell[key]
      if (!metric || !['available','nodata','unverified'].includes(metric.status) || (metric.status === 'available' ? !Number.isFinite(metric.value) : metric.value !== null)) throw new Error('Invalid terrain metric.')
    }
  }
  return value
}
export async function fetchSite04Footprint(signal: AbortSignal): Promise<Site04Footprint> {
  const value = await read('footprint', signal) as Site04Footprint
  if (!value?.center || !Number.isFinite(value.center.latitude) || !Number.isFinite(value.center.longitude) || !value.projected_bounds || !Object.values(value.projected_bounds).every(Number.isFinite) || !Array.isArray(value.boundary) || value.boundary.length < 4 || !value.boundary.every(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))) throw new Error('Invalid Site04 footprint.')
  return value
}
