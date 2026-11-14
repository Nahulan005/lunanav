/** Retained TypeScript contract prototype. Python app/schemas and OpenAPI now
 * define the mock HTTP backend; migrate consumers before removing this prototype. */
export interface Site {
  latitudeDeg: number
  longitudeDeg: number
  coordinateConvention: 'planetocentric-east-positive-minus180-to180'
  lunarFrame: string
  observerHeightAboveTerrainM: number
}
export interface Provenance {
  mode: 'mock' | 'local-derived'
  sourceIds: string[]
  datasetIds: string[]
  algorithmVersion: string
  assumptions: string[]
  limitations: string[]
  validation: 'unvalidated' | 'benchmarked'
}
export interface Result<T> { value: T; provenance: Provenance }
export interface DatasetMetadata {
  id: string
  sourceId: string
  productId: string
  originalUrl: string
  localPath: string
  sha256: string
  frame: string
  projection: string
  horizontalUnits: string
  verticalUnits: string
  verticalDatum: string
  nativePixelSpacing: { x: number; y: number; units: string } | null
  boundsDescription: string
  noDataValue: number | null
  processingHistory: string[]
}
export interface TerrainRequest { site: Site; searchRadiusM: number; azimuthStepDeg: number }
export interface TerrainResult {
  elevationM: number | null
  verticalDatum: string
  slopeDeg: number | null
  slopeBaselineM: number | null
  horizon: { azimuthDeg: number; elevationDeg: number | null }[]
  coverage: 'complete' | 'partial' | 'none'
}
export interface ImageryResult {
  localAssetPath: string | null
  footprintDescription: string | null
  metadata: DatasetMetadata | null
}
export interface EphemerisRequest {
  site: Site
  startUtc: string
  endUtc: string
  stepSeconds: number
  aberrationCorrection: 'NONE' | 'LT+S'
}
export interface GeometrySample {
  utc: string
  sun: { azimuthDeg: number; elevationDeg: number }
  earthCenter: { azimuthDeg: number; elevationDeg: number }
}
export interface EphemerisResult {
  samples: GeometrySample[]
  frame: string
  kernelIds: string[]
  coverage: 'complete' | 'partial' | 'none'
}
export interface VisibilityRequest {
  terrain: Result<TerrainResult>
  ephemeris: Result<EphemerisResult>
  angularMarginDeg: number
  targetModel: 'center-point'
}
export interface VisibilityResult {
  samples: { utc: string; sunlight: boolean | null; earthGeometricVisibility: boolean | null }[]
  radioCommunication: 'not-assessed'
}
// Expected failures must be surfaced rather than silently replaced with mock data.
export type ProviderFailureCode = 'INVALID_INPUT' | 'NO_COVERAGE' | 'MISSING_DATA' | 'INCOMPATIBLE_FRAME'
export class ProviderError extends Error {
  constructor(public readonly code: ProviderFailureCode, message: string) { super(message) }
}
export interface TerrainProvider { getTerrain(request: TerrainRequest): Promise<Result<TerrainResult>> }
export interface ImageryProvider { getImagery(site: Site): Promise<Result<ImageryResult>> }
export interface EphemerisProvider { getGeometry(request: EphemerisRequest): Promise<Result<EphemerisResult>> }
export interface VisibilityAnalysisProvider { analyze(request: VisibilityRequest): Promise<Result<VisibilityResult>> }
