
/**
 * Frontend terrain-grid display types.
 *
 * Draft interface only — confirm field names and semantics
 * with Karthi before connecting the backend.
 */

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
  instrument?: string
  instrument_url?: string
  expected_product?: string
  product_url?: string | null
  sha256?: string | null
  metadata_inspected?: boolean
  processing_version?: string | null
  validation?: 'not-inspected' | 'provisional' | 'ingestion-checked'
  checks_completed?: string[]
}

export interface CoverageCoordinateSystem {
  status?: 'unverified' | 'verified'
  frame?: string | null
  crs_wkt?: string | null
  projection?: string | null
  coordinate_units?: string | null
  axis_order?: string[] | null
  reference_surface?: string | null
  pixel_registration?: string | null
  affine_transform?: [number, number, number, number, number, number] | null
  lat_lon_transform_verified?: boolean
}

export interface CoverageSummary {
  status?: CoverageStatus
  total_pixel_count?: number | null
  valid_pixel_count?: number | null
  observed_pixel_count?: number | null
  nodata_pixel_count?: number | null
  unverified_pixel_count?: number | null
  coverage_percentage?: number | null
  percentage_definition?: string
  observation_rule?: string | null
}

export interface Site04CoverageResponse {
  schema_version?: '1.0'
  status?: CoverageStatus
  layer?: 'observation_coverage'
  site_id?: 'Site04'
  detail: string
  source?: CoverageSource
  coordinate_system?: CoverageCoordinateSystem
  value_unit?: string | null
  native_resolution?: CoverageResolution | null
  returned_resolution?: CoverageResolution | null
  source_bounds?: CoverageBounds | null
  returned_bounds?: CoverageBounds | null
  nodata_value?: number | null
  nodata_status?:
  | 'unverified'
  | 'declared-sentinel'
  | 'mask-defined'
  | 'no-sentinel-declared'

  summary?: CoverageSummary
  cells?: CoverageCell[]
  max_returned_cells?: 4096
  legend?: CoverageLegendEntry[]
  limitations: string[]
}