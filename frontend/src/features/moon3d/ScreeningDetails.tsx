import { useEffect, useState } from 'react'
import { fetchTerrainSample, isWithinLolaCoverage, type TerrainSample } from '../../services/analysis'
import { SunEarthGeometryPanel } from '../../components/SunEarthGeometryPanel'

export interface SurfaceLocation { latitude: number; longitude: number }

export function ScreeningDetails({ location, date }: { location: SurfaceLocation; date: string }) {
  const [sample, setSample] = useState<TerrainSample | null>(null)
  const [pending, setPending] = useState(false)
  const configured = Boolean(import.meta.env.VITE_API_BASE_URL?.trim())
  const covered = isWithinLolaCoverage(location.latitude, location.longitude)
  useEffect(() => {
    let active = true
    if (!configured || !covered) return
    setPending(true)
    fetchTerrainSample(location.latitude, location.longitude)
      .then((result) => {
        if (active && result && !result.isFallback && !result.isOutOfCoverage
          && result.sample.mode === 'local-derived' && Number.isFinite(result.sample.elevation_value)
          && result.sample.coordinate_requested.latitude === location.latitude
          && result.sample.coordinate_requested.longitude === location.longitude) setSample(result.sample)
      })
      .catch(() => {})
      .finally(() => { if (active) setPending(false) })
    return () => { active = false }
  }, [location.latitude, location.longitude, configured, covered])
  const south = Math.floor(location.latitude / 15) * 15
  const west = Math.floor(location.longitude / 15) * 15
  return <section className="screening-details" aria-label="Selected surface location details">
    <h3>Selected surface location · ? Unknown</h3>
    <p role="status">{location.latitude.toFixed(4)}° latitude / {location.longitude.toFixed(4)}° east longitude · {date} UTC date</p>
    <p>Display cell: {south}° to {Math.min(90, south + 15)}° latitude, {west}° to {west + 15}° longitude. These 15° cells are selection boundaries, not measured coverage or terrain resolution.</p>
    <div className="table-scroll"><table>
      <caption>Required metrics and evaluation · no configured scientific thresholds</caption>
      <thead><tr><th>Metric</th><th>Value / source</th><th>Threshold</th><th>Result</th></tr></thead>
      <tbody>
        <tr><th>Slope (mandatory)</th><td>Site-scale slope unavailable</td><td>Not configured</td><td>? Not evaluated</td></tr>
        <tr><th>Terrain horizon (mandatory)</th><td>No azimuthal horizon grid</td><td>Not configured</td><td>? Not evaluated</td></tr>
        <tr><th>Sunlight duration</th><td>No terrain-aware duration data</td><td>Not configured</td><td>? Not evaluated</td></tr>
        <tr><th>Earth geometric visibility</th><td>Directions below; no terrain clearance</td><td>Not configured</td><td>? Not evaluated</td></tr>
        <tr><th>Elevation context only</th><td>{sample ? `${sample.elevation_value} ${sample.units} · local-derived LOLA` : pending ? 'Requesting sample' : covered ? 'Demo/fallback data · no verified response' : 'Outside local LOLA coverage'}</td><td>Not a suitability criterion</td><td>Context only</td></tr>
      </tbody>
    </table></div>
    <p><strong>Combined suitability unavailable.</strong> Mandatory requirements must all pass independently; favorable Sun/Earth values cannot offset a failed slope requirement. Unknown required values remain unknown. No score is computed.</p>
    <p><strong>Recommended candidate zone: unavailable.</strong> No nearby validated cells meet configured requirements. No recommendation or candidate distance can be justified from the current point data.</p>
    {sample && <details><summary>Local-derived point provenance</summary>
      <p>{sample.source_name} · {sample.product_name} {sample.product_version}. Used cell center: {sample.coordinate_used.latitude}°, {sample.coordinate_used.longitude}°. Containing-cell sample without interpolation; never extrapolated to the display zone.</p>
      <p className="screening-checksum">Subset SHA-256: {sample.subset_checksum} · {sample.validation.status}</p>
      <ul>{sample.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul>
    </details>}
    <SunEarthGeometryPanel request={{ ...location, siteId: 'custom', landingDate: date }} />
    <details><summary>Planned grid contract needed for screening</summary>
      <p>Georeferenced cell bounds and centers, coordinate frame and datum, native resolution, nodata/coverage flags, site-scale slope with baseline and validation, terrain horizon by azimuth, observer height, time window and sampling, terrain-masked Sun/Earth metrics, source IDs and checksums, uncertainty, and versioned mandatory thresholds with margins. Candidate selection additionally needs comparable neighboring cells and a documented distance model.</p>
      <p>Current coarse LOLA cardinal-gradient estimates do not establish site-scale slope or safe landing conditions. Geometric Earth directions do not establish RF communication. No landing safety or mission success assessment.</p>
    </details>
  </section>
}
