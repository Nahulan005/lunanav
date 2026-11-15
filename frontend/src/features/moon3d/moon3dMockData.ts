/**
 * Isolated Moon3D Mock Data and Types for LunaNav
 *
 * SCIENTIFIC HONESTY DISCLAIMER:
 * All coordinates, surface features, heatmap indices, and site telemetry in this
 * module are illustrative demo fixtures. They do not represent live NASA telemetry,
 * real-time SPICE ephemerides, or certified mission-critical calculations.
 */

export const MOON3D_DISCLAIMER =
  'Illustrative demo data. Surface detail, heatmap overlays, and telemetry ratings are simulated visualizations for concept demonstration and do not reflect real-time NASA telemetry, SPICE ephemerides, or certified mission calculations.'

export type HeatmapMode = 'none' | 'sunlight' | 'earth-visibility' | 'feasibility'

export interface HeatmapLegendStop {
  readonly label: string
  readonly color: string
  readonly description: string
}

export interface HeatmapConfig {
  readonly id: HeatmapMode
  readonly label: string
  readonly shortCode: string
  readonly description: string
  readonly disclaimer: string
  readonly stops: readonly HeatmapLegendStop[]
}

export interface Moon3DLandingSite {
  readonly id: string
  readonly name: string
  readonly region: string
  readonly latitude: number
  readonly longitude: number
  readonly elevationKm: number
  readonly sunlightPct: number
  readonly earthVisibilityPct: number
  readonly feasibilityScore: number
  readonly terrainObstructionPct: number
  readonly historicalContext: string
  readonly description: string
  readonly targetType: 'polar-rim' | 'mare-plain' | 'highland-crater' | 'volcanic-dome'
}

export interface CraterFeature {
  readonly name: string
  readonly latitude: number
  readonly longitude: number
  readonly radiusKm: number
  readonly depthKm: number
  readonly hasRays: boolean
}

export interface MareFeature {
  readonly name: string
  readonly latitude: number
  readonly longitude: number
  readonly radiusKm: number
  readonly opacity: number
}

export const HEATMAP_CONFIGS: Record<HeatmapMode, HeatmapConfig> = {
  none: {
    id: 'none', label: 'Natural Regolith ? illustrative', shortCode: 'SURF / DEMO',
    description: 'Neutral grayscale procedural surface. Brightness depicts decorative surface detail only.',
    disclaimer: 'No measured reflectance, elevation, or permanent-shadow classification.',
    stops: [{ label: 'Light gray', color: '#bcbcbc', description: 'Decorative bright terrain' }, { label: 'Dark gray', color: '#303030', description: 'Decorative maria and shading' }],
  },
  sunlight: {
    id: 'sunlight', label: 'Sunlight Availability ? decorative demo', shortCode: 'SUN / DEMO',
    description: 'Demo layer ? preset sites only. Amber nodes display existing fixed sunlight percentages; arbitrary surface points have no layer data.',
    disclaimer: 'No illumination percentages, durations, terrain masking, or ephemeris-derived coverage are represented.',
    stops: [{ label: 'Amber preset node', color: '#ffd773', description: 'Existing sunlight fixture percentage; not calculated' }, { label: 'Unmarked surface', color: '#514022', description: 'No data for this layer' }],
  },
  'earth-visibility': {
    id: 'earth-visibility', label: 'Earth Direct Line-of-Sight ? decorative demo', shortCode: 'EARTH / DEMO',
    description: 'Demo layer ? preset sites only. Cyan nodes display existing fixed Earth-visibility percentages; arbitrary surface points have no layer data.',
    disclaimer: 'Shading does not establish geometric terrain clearance, visibility duration, or RF communications.',
    stops: [{ label: 'Cyan preset node', color: '#5ac9ed', description: 'Existing Earth-visibility fixture percentage; not calculated' }, { label: 'Unmarked surface', color: '#132b50', description: 'No data for this layer' }],
  },
  feasibility: {
    id: 'feasibility', label: 'Landing Feasibility ? unavailable', shortCode: 'SCREEN / UNKNOWN',
    description: 'Grey cells show unknown screening status. Dashed boundaries are display cells, not validated data coverage.',
    disclaimer: 'Required spatial grid, mandatory site-scale slope, terrain horizons, and configured thresholds are unavailable. No suitability score or safety assessment is computed.',
    stops: [{ label: '? GREY / Unknown', color: '#8899aa', description: 'Missing or insufficient required data; cannot classify as favorable' }],
  },
}

export const MOON3D_LANDING_SITES: readonly Moon3DLandingSite[] = [
  {
    id: 'shackleton',
    name: 'Shackleton Rim',
    region: 'Lunar South Pole',
    latitude: -89.9,
    longitude: 0.0,
    elevationKm: 1.2,
    sunlightPct: 88,
    earthVisibilityPct: 91,
    feasibilityScore: 89,
    terrainObstructionPct: 14,
    historicalContext: 'Artemis Exploration Candidate Zone',
    description:
      'High-elevation rim at the lunar south pole. Features extended solar illumination windows and cold traps with potential water-ice volatiles.',
    targetType: 'polar-rim',
  },
  {
    id: 'apollo11',
    name: 'Tranquility Base',
    region: 'Mare Tranquillitatis',
    latitude: 0.67,
    longitude: 23.47,
    elevationKm: -1.4,
    sunlightPct: 52,
    earthVisibilityPct: 99,
    feasibilityScore: 86,
    terrainObstructionPct: 6,
    historicalContext: 'Apollo 11 Landing Site (1969)',
    description:
      'Historic first crewed landing site on a basaltic mare plain with low local slope and direct equatorial Earth line-of-sight.',
    targetType: 'mare-plain',
  },
  {
    id: 'apollo17',
    name: 'Taurusâ€“Littrow Valley',
    region: 'Mare Serenitatis Border',
    latitude: 20.19,
    longitude: 30.77,
    elevationKm: -2.1,
    sunlightPct: 54,
    earthVisibilityPct: 98,
    feasibilityScore: 82,
    terrainObstructionPct: 19,
    historicalContext: 'Apollo 17 Mission Site (1972)',
    description:
      'Deep graben valley surrounded by the North and South Massifs. High geological diversity with complex terrain obstruction tradeoffs.',
    targetType: 'highland-crater',
  },
  {
    id: 'change5',
    name: 'Mons RÃ¼mker / Changâ€™e 5',
    region: 'Oceanus Procellarum',
    latitude: 43.06,
    longitude: -51.92,
    elevationKm: -1.8,
    sunlightPct: 50,
    earthVisibilityPct: 84,
    feasibilityScore: 78,
    terrainObstructionPct: 11,
    historicalContext: 'Changâ€™e 5 Sample Return Site (2020)',
    description:
      'Young volcanic dome mound in northern Oceanus Procellarum with vast smooth basalt plains and high titanium basalt signatures.',
    targetType: 'volcanic-dome',
  },
  {
    id: 'clavius',
    name: 'Clavius Basin',
    region: 'Southern Highlands',
    latitude: -58.4,
    longitude: -14.4,
    elevationKm: -1.1,
    sunlightPct: 62,
    earthVisibilityPct: 81,
    feasibilityScore: 71,
    terrainObstructionPct: 24,
    historicalContext: 'SOFIA Stratospheric Observatory Target',
    description:
      'Prominent southern highland impact crater with complex floor topography and notable stratospheric observations of hydration signatures.',
    targetType: 'highland-crater',
  },
  {
    id: 'malapert',
    name: 'Malapert Mountain',
    region: 'South Polar Highlands',
    latitude: -84.9,
    longitude: 12.9,
    elevationKm: 4.8,
    sunlightPct: 94,
    earthVisibilityPct: 93,
    feasibilityScore: 92,
    terrainObstructionPct: 8,
    historicalContext: 'Peak of Eternal Light Candidate',
    description:
      'Massive 5-kilometer high ridge near the south pole with continuous optical visibility toward Earth and long solar access windows.',
    targetType: 'polar-rim',
  },
  {
    id: 'aristarchus',
    name: 'Aristarchus Plateau',
    region: 'Oceanus Procellarum East',
    latitude: 23.73,
    longitude: -47.49,
    elevationKm: 0.4,
    sunlightPct: 53,
    earthVisibilityPct: 88,
    feasibilityScore: 75,
    terrainObstructionPct: 17,
    historicalContext: 'High-Albedo Pyroclastic Feature',
    description:
      'Brightest large feature on the lunar nearside, hosting the sinuous rille Vallis SchrÃ¶teri and extensive pyroclastic glass deposits.',
    targetType: 'volcanic-dome',
  },
]

export const LUNAR_MARIA: readonly MareFeature[] = [
  { name: 'Mare Tranquillitatis', latitude: 8.5, longitude: 31.4, radiusKm: 440, opacity: 0.52 },
  { name: 'Mare Serenitatis', latitude: 28.0, longitude: 17.5, radiusKm: 340, opacity: 0.48 },
  { name: 'Mare Imbrium', latitude: 32.8, longitude: -15.6, radiusKm: 580, opacity: 0.54 },
  { name: 'Oceanus Procellarum', latitude: 18.4, longitude: -57.4, radiusKm: 950, opacity: 0.42 },
  { name: 'Mare Crisium', latitude: 17.0, longitude: 59.1, radiusKm: 280, opacity: 0.58 },
  { name: 'Mare Fecunditatis', latitude: -7.8, longitude: 51.3, radiusKm: 390, opacity: 0.46 },
  { name: 'Mare Nectaris', latitude: -15.2, longitude: 35.5, radiusKm: 180, opacity: 0.45 },
  { name: 'Mare Nubium', latitude: -21.3, longitude: -16.6, radiusKm: 350, opacity: 0.44 },
  { name: 'Mare Humorum', latitude: -24.4, longitude: -38.6, radiusKm: 210, opacity: 0.5 },
]

export const LUNAR_CRATERS: readonly CraterFeature[] = [
  { name: 'Tycho', latitude: -43.31, longitude: -11.36, radiusKm: 85, depthKm: 4.8, hasRays: true },
  { name: 'Copernicus', latitude: 9.62, longitude: -20.08, radiusKm: 93, depthKm: 3.8, hasRays: true },
  { name: 'Kepler', latitude: 8.12, longitude: -38.01, radiusKm: 32, depthKm: 2.6, hasRays: true },
  { name: 'Aristarchus', latitude: 23.73, longitude: -47.49, radiusKm: 40, depthKm: 3.0, hasRays: true },
  { name: 'Clavius', latitude: -58.4, longitude: -14.4, radiusKm: 231, depthKm: 4.9, hasRays: false },
  { name: 'Plato', latitude: 51.6, longitude: -9.3, radiusKm: 101, depthKm: 2.0, hasRays: false },
  { name: 'Langrenus', latitude: -8.9, longitude: 61.0, radiusKm: 132, depthKm: 4.5, hasRays: false },
  { name: 'Grimaldi', latitude: -5.2, longitude: -68.6, radiusKm: 222, depthKm: 2.7, hasRays: false },
  { name: 'Eratosthenes', latitude: 14.5, longitude: -11.3, radiusKm: 59, depthKm: 3.4, hasRays: false },
  { name: 'Archimedes', latitude: 29.7, longitude: -4.0, radiusKm: 83, depthKm: 1.6, hasRays: false },
  { name: 'Stevinus', latitude: -32.5, longitude: 54.2, radiusKm: 75, depthKm: 3.8, hasRays: false },
  { name: 'Bullialdus', latitude: -20.7, longitude: -22.2, radiusKm: 61, depthKm: 3.5, hasRays: false },
]

/**
 * Deterministic highland crater seeds for realistic surface density.
 */
export const PROCEDURAL_CRATER_SEEDS = Array.from({ length: 110 }, (_, i) => {
  const seed = i * 47 + 19
  const lat = ((seed * 71) % 160) - 80
  const lon = ((seed * 113) % 360) - 180
  const rad = 14 + (seed % 38)
  return { lat, lon, rad }
})
