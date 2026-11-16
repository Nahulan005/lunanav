import type { Site04CoverageResponse } from './terrainGrid'
import type { SurfaceLocation } from './ScreeningDetails'

/** Availability explanation only. No risk formula or scientific thresholds exist yet. */
export function OverallRiskStatus({ location, date, coverage, loading }: {
  location: SurfaceLocation
  date: string
  coverage: Site04CoverageResponse | null
  loading: boolean
}) {
  const hasCoverage = !loading && coverage !== null && coverage.status !== 'unavailable' && coverage.cells.length > 0
  return <section className="overall-risk-status" aria-label="Overall risk evaluation status">
    <span className="overall-risk-eyebrow">Overall risk layer</span>
    <h3>Unknown — not evaluated</h3>
    <p>{location.latitude.toFixed(4)}° latitude / {location.longitude.toFixed(4)}° east longitude · {date} UTC date</p>
    <p>Not enough data to determine overall risk. Grey means insufficient evidence, not low risk. No score or recommendation is available.</p>
    <dl className="overall-risk-inputs">
      <div><dt>Site-scale slope</dt><dd>Unavailable · no Site04 slope grid connected</dd></div>
      <div><dt>Terrain horizon by azimuth</dt><dd>Unavailable · no horizon grid connected</dd></div>
      <div><dt>Terrain-aware sunlight duration</dt><dd>Unavailable · point-in-time directions do not establish duration</dd></div>
      <div><dt>Terrain-cleared Earth visibility</dt><dd>Unavailable · directions alone do not establish clearance or RF communications</dd></div>
      <div><dt>Mission constraints and thresholds</dt><dd>Not configured · no pass/fail evaluation can run</dd></div>
      <div><dt>Shared spatial registration</dt><dd>Unverified · Site04 X/Y to lunar latitude/longitude mapping is not verified</dd></div>
    </dl>
    <div className="overall-risk-evidence" role="status">
      <strong>Separate supporting evidence: observation coverage</strong>
      <p>{loading ? 'Requesting Site04 coverage.' : hasCoverage ? `${coverage.cells.length} native cells returned · API ${coverage.status} · source ${coverage.source.expected_product}.` : 'Site04 coverage unavailable. No substitute cells are used.'}</p>
      <p>Observation counts describe sampling only. They do not classify this selected point or its surrounding area; the grid remains in its separate projected X/Y view.</p>
    </div>
    <details><summary>What would enable a real risk layer?</summary>
      <p>Comparable cells with verified lunar coordinates, slope and its spatial baseline, azimuthal terrain horizons, time-sampled terrain-aware Sun/Earth geometry, uncertainty and provenance, plus documented mission constraints with thresholds.</p>
      <p>Every mandatory criterion must be evaluated independently. A failed mandatory requirement must not be offset by a strong result elsewhere. Missing required inputs must remain Unknown.</p>
    </details>
  </section>
}
