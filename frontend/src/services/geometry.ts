import type { AnalysisRequest } from '../data/mockData'
import { API_BASE_URL } from './apiConfig'

// Mirrors lunanav-science/backend/app/schemas/geometry.py.
export interface TargetDirection {
  azimuth_deg: number
  elevation_deg: number
  right_ascension: string | null
  declination: string | null
}

export interface SunEarthObservation {
  timestamp_utc: string
  sun: TargetDirection
  earth: TargetDirection
  reference_frame: string
  reference_ellipsoid: string
  solar_presence: string | null
  interfering_body: string | null
}

export interface SunEarthGeometryResponse {
  status: 'available' | 'unavailable' | 'unsupported'
  provider_name: 'JPL Horizons On-Line Ephemeris System (API v1.3)'
  requested_site_id: string
  requested_latitude: number
  requested_longitude: number
  requested_date: string
  request_parameters: {
    api_url: string
    http_method: 'GET'
    sun_parameters: Record<string, string>
    earth_parameters: Record<string, string>
  }
  live_request_executed: boolean
  provenance_url: string
  documentation_url: string
  limitation_explanation: string[]
  observation: SunEarthObservation | null
  observations: SunEarthObservation[]
  detail: string | null
}

export const geometryConfigured = Boolean(API_BASE_URL)

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const nullableString = (value: unknown) => value === null || typeof value === 'string'
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
const stringRecord = (value: unknown) => object(value) && Object.values(value).every((item) => typeof item === 'string')
const bounded = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

function direction(value: unknown): boolean {
  return object(value) && bounded(value.azimuth_deg, 0, 360) && value.azimuth_deg !== 360
    && bounded(value.elevation_deg, -90, 90)
    && nullableString(value.right_ascension) && nullableString(value.declination)
}

function observation(value: unknown): boolean {
  return object(value) && typeof value.timestamp_utc === 'string'
    && /(?:Z|[+-]00:00)$/.test(value.timestamp_utc) && Number.isFinite(Date.parse(value.timestamp_utc))
    && direction(value.sun) && direction(value.earth)
    && typeof value.reference_frame === 'string' && typeof value.reference_ellipsoid === 'string'
    && nullableString(value.solar_presence) && nullableString(value.interfering_body)
}

function geometryResponse(value: unknown): value is SunEarthGeometryResponse {
  if (!object(value) || !object(value.request_parameters)) return false
  const parameters = value.request_parameters
  return ['available', 'unavailable', 'unsupported'].includes(String(value.status))
    && value.provider_name === 'JPL Horizons On-Line Ephemeris System (API v1.3)'
    && typeof value.requested_site_id === 'string'
    && bounded(value.requested_latitude, -90, 90) && bounded(value.requested_longitude, -180, 180)
    && typeof value.requested_date === 'string'
    && typeof parameters.api_url === 'string' && parameters.http_method === 'GET'
    && stringRecord(parameters.sun_parameters) && stringRecord(parameters.earth_parameters)
    && typeof value.live_request_executed === 'boolean'
    && typeof value.provenance_url === 'string' && typeof value.documentation_url === 'string'
    && strings(value.limitation_explanation) && nullableString(value.detail)
    && (value.observation === null || observation(value.observation))
    && Array.isArray(value.observations) && value.observations.every(observation)
}

export async function fetchSunEarthGeometry(request: AnalysisRequest, signal: AbortSignal): Promise<SunEarthGeometryResponse | null> {
  const params = new URLSearchParams({
    latitude: String(request.latitude), longitude: String(request.longitude),
    landingDate: request.landingDate, siteId: request.siteId,
  })
  const response = await fetch(`${API_BASE_URL}/api/v1/geometry/sun-earth?${params}`, { signal })
  if (!response.ok) throw new Error(`Geometry unavailable (HTTP ${response.status}).`)
  const data: unknown = await response.json()
  if (!geometryResponse(data)) throw new Error('Geometry response could not be verified.')
  if (data.requested_latitude !== request.latitude || data.requested_longitude !== request.longitude
    || data.requested_date !== request.landingDate || data.requested_site_id !== request.siteId) {
    throw new Error('Geometry response does not match the selected configuration.')
  }
  if (data.observation && data.observation.timestamp_utc.slice(0, 10) !== request.landingDate) {
    throw new Error('Geometry timestamp does not match the selected date.')
  }
  return data
}
