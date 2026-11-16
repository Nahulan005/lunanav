
/** Mirrors the merged backend Site04 observation-coverage contract. */

export type CoverageStatus =
  | 'unavailable'
  | 'provisional'
  | 'available'

export type ObservationStatus =
  | 'observed'
  | 'unobserved'
  | 'nodata'
  | 'unverified'

export interface CoverageBounds {
  min_x: number
  min_y: number
  max_x: number
  max_y: number
}

export interface CoverageCell {
  row: number
  column: number
  bounds: CoverageBounds
  value: number | null
  value_unit: string | null
  observation_status: ObservationStatus
}

export interface CoverageLegendEntry {
  status: ObservationStatus
  label: string
  color: string
  symbol: string
}

export interface CoverageResolution {
  x_spacing: number
  y_spacing: number
  units: string
  rows: number
  columns: number
}

export interface CoverageSource {
  instrument: string
  instrument_url: string
  expected_product: string
  product_url: string | null
  sha256: string | null
  metadata_inspected: boolean
  processing_version: string | null
  validation: 'not-inspected' | 'provisional' | 'ingestion-checked'
  checks_completed: string[]
}

export interface CoverageCoordinateSystem {
  status: 'unverified' | 'verified'
  frame: string | null
  crs_wkt: string | null
  projection: string | null
  coordinate_units: string | null
  axis_order: string[] | null
  reference_surface: string | null
  pixel_registration: string | null
  affine_transform: [number, number, number, number, number, number] | null
  lat_lon_transform_verified: boolean
}

export interface CoverageSummary {
  status: CoverageStatus
  total_pixel_count: number | null
  valid_pixel_count: number | null
  observed_pixel_count: number | null
  nodata_pixel_count: number | null
  unverified_pixel_count: number | null
  coverage_percentage: number | null
  percentage_definition: string
  observation_rule: string | null
}

export interface Site04CoverageResponse {
  schema_version: '1.0'
  status: CoverageStatus
  layer: 'observation_coverage'
  site_id: 'Site04'
  detail: string
  source: CoverageSource
  coordinate_system: CoverageCoordinateSystem
  value_unit: string | null
  native_resolution: CoverageResolution | null
  returned_resolution: CoverageResolution | null
  source_bounds: CoverageBounds | null
  returned_bounds: CoverageBounds | null
  nodata_value: number | null
  nodata_status:
  | 'unverified'
  | 'declared-sentinel'
  | 'mask-defined'
  | 'no-sentinel-declared'

  summary: CoverageSummary
  cells: CoverageCell[]
  max_returned_cells: 4096
  legend: CoverageLegendEntry[]
  limitations: string[]
}
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')
const bounds = (v: unknown): v is CoverageBounds => object(v) && finite(v.min_x) && finite(v.max_x) && finite(v.min_y) && finite(v.max_y) && v.min_x < v.max_x && v.min_y < v.max_y

/** Fail closed for malformed/unsupported payloads; never substitute demo cells. */
export function isSite04CoverageResponse(v: unknown): v is Site04CoverageResponse {
  if (!object(v) || v.schema_version !== '1.0' || v.layer !== 'observation_coverage' || v.site_id !== 'Site04'
    || !['available','provisional','unavailable'].includes(String(v.status)) || typeof v.detail !== 'string'
    || !strings(v.limitations) || !object(v.source) || !object(v.coordinate_system) || !object(v.summary)
    || !Array.isArray(v.cells) || v.cells.length > 4096 || v.max_returned_cells !== 4096
    || !Array.isArray(v.legend) || !v.legend.every(x => object(x) && typeof x.label === 'string' && typeof x.symbol === 'string' && typeof x.color === 'string' && ['observed','unobserved','nodata','unverified'].includes(String(x.status)))) return false
  if (v.status === 'unavailable' || v.cells.length === 0) return v.cells.length === 0
  const b = v.returned_bounds, r = v.returned_resolution
  if (!bounds(b) || !bounds(v.source_bounds) || !object(r) || r.rows !== 32 || r.columns !== 32
    || !finite(r.x_spacing) || !finite(r.y_spacing) || r.x_spacing <= 0 || r.y_spacing <= 0
    || typeof r.units !== 'string' || v.coordinate_system.status !== 'verified'
    || r.units !== v.coordinate_system.coordinate_units || !Array.isArray(v.coordinate_system.affine_transform)
    || v.coordinate_system.affine_transform.length !== 6 || !v.coordinate_system.affine_transform.every(finite)) return false
  const count = new Set<string>()
  for (const c of v.cells) {
    if (!object(c) || !Number.isInteger(c.row) || !Number.isInteger(c.column)
      || Number(c.row) < 0 || Number(c.column) < 0 || !bounds(c.bounds)
      || !['observed','unobserved','nodata','unverified'].includes(String(c.observation_status))
      || !(c.value === null || finite(c.value)) || !(c.value_unit === null || typeof c.value_unit === 'string')) return false
    if (c.observation_status === 'observed' && (!finite(c.value) || !Number.isInteger(c.value) || c.value <= 0)) return false
    if (c.observation_status === 'unobserved' && c.value !== 0) return false
    if ((c.observation_status === 'nodata' || c.observation_status === 'unverified') && c.value !== null) return false
    const cb = c.bounds
    if (cb.min_x < b.min_x || cb.max_x > b.max_x || cb.min_y < b.min_y || cb.max_y > b.max_y
      || Math.abs(cb.max_x-cb.min_x-r.x_spacing)>1e-6 || Math.abs(cb.max_y-cb.min_y-r.y_spacing)>1e-6) return false
    const key = `${cb.min_x},${cb.min_y}`
    if (count.has(key)) return false
    count.add(key)
  }
  return true
}
