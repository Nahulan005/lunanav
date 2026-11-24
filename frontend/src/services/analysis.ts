import { demoAnalyses, type AnalysisRequest, type DemoAnalysis } from '../data/mockData'
import { isSite04CoverageResponse, type Site04CoverageResponse } from '../features/moon3d/terrainGrid'

import { API_BASE_URL } from './apiConfig'
export { API_BASE_URL } from './apiConfig'
export const HEALTH_ENDPOINT = `${API_BASE_URL}/api/v1/health`
export const ANALYSIS_ENDPOINT = `${API_BASE_URL}/api/v1/analysis`
export const TERRAIN_SAMPLE_ENDPOINT = `${API_BASE_URL}/api/v1/terrain/sample`
export const SITE04_COVERAGE_ENDPOINT = `${API_BASE_URL}/api/v1/terrain/site04/coverage`

// Bounded allowance for a deployed backend to respond; retries are user initiated.
const REQUEST_TIMEOUT_MS = 15000

export interface BackendHealthResponse {
  status: string
  service: string
  mode: string
  live_nasa_integrations: string[]
}

export interface TerrainSample {
  mode: string
  source_name: string
  source_url: string
  product_name: string
  product_version: string
  coordinate_requested: { latitude: number; longitude: number }
  coordinate_used: { latitude: number; longitude: number }
  coordinate_convention: string
  coordinate_reference_system: string
  sampling_method: string
  elevation_value: number
  units: string
  reference_radius_m: number
  nodata_status: string
  checksum: string
  subset_checksum: string
  validation: {
    status: string
    checks: string[]
    coordinate_roundtrip_passed: boolean
    scientific_accuracy_validated: boolean
  }
  limitations: string[]
}

export interface BackendAnalysisResponse {
  schema_version: string
  mode: string
  request: {
    siteId: string
    latitude: number
    longitude: number
    landingDate: string
  }
  terrain: {
    value: {
      elevation_m: number | null
      vertical_datum: string
      slope_deg: number | null
      coverage: string
    }
    provenance: {
      mode: string
      provider: string
      algorithm_version: string
      assumptions: string[]
      limitations: string[]
    }
  }
  ephemeris: unknown
  imagery: unknown
  visibility: {
    value: {
      samples: Array<{
        utc: string
        sunlight: boolean | null
        earth_geometric_visibility: boolean | null
      }>
      radio_communication: string
      coverage: string
    }
    provenance: unknown
  }
  mission_assessment: string
  warnings: string[]
  source_references: Array<{
    id: string
    official_name: string
    official_url: string
    integration_status: string
    used_in_calculation: boolean
  }>
}

export interface AnalyzeMissionResult {
  analysis: DemoAnalysis
  backendResponse: BackendAnalysisResponse | null
  isBackend: boolean
}

export interface TerrainSampleResult {
  sample: TerrainSample
  isFallback: boolean
  isOutOfCoverage?: boolean
}

export function isWithinLolaCoverage(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  const eastLon = ((longitude % 360) + 360) % 360
  return latitude > 12 && latitude <= 28 && eastLon >= 24 && eastLon < 40
}

export const fallbackTerrainSample: TerrainSample = {
  mode: 'local-derived',
  source_name: 'NASA LRO / Lunar Orbiter Laser Altimeter (LOLA), NASA PDS Geosciences Node',
  source_url: 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_4.img',
  product_name: 'LDEM_4',
  product_version: 'V3.0',
  coordinate_requested: { latitude: 20.19, longitude: 30.77 },
  coordinate_used: { latitude: 20.125, longitude: 30.875 },
  coordinate_convention: 'planetocentric; east-positive longitude; API [-180,180], source [0,360)',
  coordinate_reference_system: 'Moon MEAN EARTH/POLAR AXIS OF DE421; simple cylindrical/equirectangular, central meridian 180 deg, standard parallel 0 deg, sphere radius 1737400 m; no Earth EPSG CRS',
  sampling_method: 'containing native grid cell; no interpolation',
  elevation_value: -2662.0,
  units: 'm',
  reference_radius_m: 1737400.0,
  nodata_status: 'not-flagged-no-sentinel-declared',
  checksum: 'c04632eba6449af49e3108ed7c25b3b1c450600abd3690df4fc815853a1af476',
  subset_checksum: '02384ab144d5f90221040d5fd8e7d05b84820e8dd85e7ae6f424ef272a1b30cd',
  validation: {
    status: 'ingestion-verified-not-scientifically-validated',
    checks: ['audited LDEM_4 cutout demo fixture', 'runtime bounds check'],
    coordinate_roundtrip_passed: true,
    scientific_accuracy_validated: false,
  },
  limitations: [
    'Offline sample fixture based on the audited Apollo 17 LDEM_4 cutout.',
    'Earth geometric visibility does not establish radio communication.',
    'Not scientifically validated for mission landing operations.'
  ],
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

/** Keep the timeout active through JSON decoding, not just response headers. */
async function requestJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}.`)
    try { return await response.json() as unknown }
    catch (error) {
      if (controller.signal.aborted) throw error
      throw new Error('Invalid response: backend did not return readable JSON.')
    }
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Request timed out after 15 seconds. Retry to check again.')
    if (error instanceof TypeError) throw new Error('Backend unreachable: check connectivity, API URL, or CORS settings.')
    throw error
  } finally { clearTimeout(timer) }
}
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Backend request failed.'

export async function checkBackendHealthResult(): Promise<{ connected: boolean; error: string | null }> {
  try {
    const data = await requestJson(HEALTH_ENDPOINT)
    if (typeof data !== 'object' || !data || !('status' in data) || data.status !== 'ok') {
      return { connected: false, error: 'Backend health unavailable: no valid OK status returned.' }
    }
    return { connected: true, error: null }
  } catch (error) { return { connected: false, error: errorMessage(error) } }
}
export async function checkBackendHealth(): Promise<boolean> {
  return (await checkBackendHealthResult()).connected
}

export async function analyzeMissionDemo(request: AnalysisRequest): Promise<DemoAnalysis> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 400))
  return demoAnalyses[request.siteId] ?? demoAnalyses.custom
}

export async function analyzeMission(request: AnalysisRequest): Promise<AnalyzeMissionResult> {
  const payload = {
    siteId: request.siteId,
    latitude: Number(request.latitude),
    longitude: Number(request.longitude),
    landingDate: request.landingDate,
    duration_days: 7,
    observer_height_m: 2,
    coordinate_convention: 'planetocentric-east-positive-minus180-to180' as const,
  }

  try {
    const res = await fetchWithTimeout(ANALYSIS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`)
    }

    const data: BackendAnalysisResponse = await res.json()
    const baseline = demoAnalyses[request.siteId] ?? demoAnalyses.custom
    return {
      analysis: baseline,
      backendResponse: data,
      isBackend: true,
    }
  } catch {
    // If backend is unavailable, silently use existing mock data
    const fallback = await analyzeMissionDemo(request)
    return {
      analysis: fallback,
      backendResponse: null,
      isBackend: false,
    }
  }
}

export async function fetchTerrainSample(latitude: number, longitude: number, onError?: (message: string) => void): Promise<TerrainSampleResult | null> {
  if (!isWithinLolaCoverage(latitude, longitude)) {
    return {
      sample: {
        ...fallbackTerrainSample,
        coordinate_requested: { latitude, longitude },
      },
      isFallback: true,
      isOutOfCoverage: true,
    }
  }

  const url = `${TERRAIN_SAMPLE_ENDPOINT}?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`
  try {
    const data = await requestJson(url) as TerrainSample
    if (!data || data.mode !== 'local-derived' || !Number.isFinite(data.elevation_value)
      || data.coordinate_requested?.latitude !== latitude || data.coordinate_requested?.longitude !== longitude) {
      throw new Error('Invalid response: terrain sample does not match the selected coordinates.')
    }
    return { sample: data, isFallback: false, isOutOfCoverage: false }
  } catch (error) {
    onError?.(errorMessage(error))
    return null
  }
}

export async function fetchSite04CoverageResult(): Promise<{ data: Site04CoverageResponse | null; error: string | null }> {
  try {
    const data = await requestJson(SITE04_COVERAGE_ENDPOINT)
    if (!isSite04CoverageResponse(data)) return { data: null, error: 'Invalid response: Site04 coverage payload did not match the supported contract.' }
    return { data, error: null }
  } catch (error) { return { data: null, error: errorMessage(error) } }
}
export async function fetchSite04Coverage(): Promise<Site04CoverageResponse | null> {
  return (await fetchSite04CoverageResult()).data
}
