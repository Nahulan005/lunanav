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
  const response = await fetch(`${API_BASE_URL}/api/v1/terrain/site04/${path}`, { signal })
  if (!response.ok) {
    if (response.status === 422) throw new Error('Outside Site04 terrain coverage or invalid coordinates. No substitute terrain is shown.')
    throw new Error(`Site04 API unavailable (HTTP ${response.status}).`)
  }
  return response.json()
}
export async function fetchSite04Terrain(point: GeographicPoint, signal: AbortSignal): Promise<Site04Terrain> {
  const value = await read(`grid?${new URLSearchParams({latitude:String(point.latitude),longitude:String(point.longitude),width:'32'})}`, signal) as Site04Terrain
  if (!value || !['provisional','unavailable'].includes(value.status) || !Array.isArray(value.cells) || value.cells.length > 1024 || !Array.isArray(value.sources) || !Array.isArray(value.limitations)) throw new Error('Invalid Site04 terrain response.')
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
  if (!value?.center || !Number.isFinite(value.center.latitude) || !Number.isFinite(value.center.longitude) || !value.projected_bounds) throw new Error('Invalid Site04 footprint.')
  return value
}
