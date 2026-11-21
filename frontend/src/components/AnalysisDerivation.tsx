import { Info } from 'lucide-react'
import type { AnalysisRequest } from '../data/mockData'
import type { TerrainSample } from '../services/analysis'
import type { GeometryPanelState } from './SunEarthGeometryPanel'

interface Props {
  request: AnalysisRequest
  siteName: string
  terrain: TerrainSample | null
  terrainLoading: boolean
  terrainError: string | null
  outsideCoverage: boolean
  geometry: GeometryPanelState | null
}

const coordinate = (value: number) => Number.isFinite(value) ? `${value.toFixed(4)}°` : 'Unknown'
const altitude = (value: number) => value === 0 ? 'on the geometric horizon'
  : `${Math.abs(value).toFixed(2)}° ${value > 0 ? 'above' : 'below'} the geometric horizon`

export function AnalysisDerivation({ request, siteName, terrain, terrainLoading, terrainError, outsideCoverage, geometry }: Props) {
  const current = geometry?.requestKey === JSON.stringify(request) ? geometry : null
  const response = current?.response
  const observation = !current?.loading && response?.status === 'available' && response.live_request_executed
    ? response.observation : null
  const utc = observation?.timestamp_utc.replace('T', ' ').replace(/(?:Z|\+00:00)$/, ' UTC')
  const terrainStatus = terrainLoading ? 'Requesting a terrain sample…'
    : terrain ? `LOLA returned ${terrain.elevation_value} ${terrain.units} for the cell containing the selected coordinates.`
      : outsideCoverage ? 'This site is outside the local LOLA point-elevation dataset.'
        : terrainError ?? 'No matching LOLA point elevation is available.'

  return <section className="panel derivation-panel" aria-labelledby="analysis-derivation-title">
    <div className="section-heading">
      <h2 id="analysis-derivation-title"><Info size={16} />What the data tells us</h2>
      <span className="small-badge">SUITABILITY NOT EVALUATED</span>
    </div>
    {observation ? <p className="analysis-finding">
      At <strong>{siteName}</strong> on {utc}, the Sun’s centre was <strong>{altitude(observation.sun.elevation_deg)}</strong> and Earth’s centre was <strong>{altitude(observation.earth.elevation_deg)}</strong>.
    </p> : <p className="analysis-finding">{current?.loading ? 'Requesting Horizons geometry for this site and date…' : 'No Horizons angles are available for this site and date yet. See the geometry panel below for the request status.'}</p>}
    <p className="tab-context-note">{terrainStatus}</p>
    <p className="tab-context-note">Terrain clearance needs the horizon angle in the direction of each target. Landing suitability also needs slope, roughness and mission thresholds.</p>
    <details className="derivation-provenance">
      <summary>How we got this</summary>
      <dl className="derivation-steps">
        <div><dt>Inputs</dt><dd>{siteName} · {coordinate(request.latitude)} latitude · {coordinate(request.longitude)} east longitude · {request.landingDate || 'Date not set'} UTC.</dd></div>
        <div><dt>Horizons response</dt><dd>{observation ? <>
          <span>{response?.provider_name} · {utc}</span>
          <span>Sun: {observation.sun.azimuth_deg.toFixed(2)}° azimuth, {observation.sun.elevation_deg.toFixed(2)}° elevation.</span>
          <span>Earth: {observation.earth.azimuth_deg.toFixed(2)}° azimuth, {observation.earth.elevation_deg.toFixed(2)}° elevation.</span>
          <span>{observation.reference_frame} · {observation.reference_ellipsoid}</span>
        </> : current?.loading ? 'Awaiting provider response.' : response?.detail ?? current?.error ?? 'No matching observation returned.'}</dd></div>
        <div><dt>LOLA point sample</dt><dd>{terrainStatus}{terrain && <>
          <span>{terrain.product_name} {terrain.product_version} · {terrain.sampling_method}</span>
          <span>Cell centre: {coordinate(terrain.coordinate_used.latitude)} latitude, {coordinate(terrain.coordinate_used.longitude)} east longitude.</span>
        </>}</dd></div>
        <div><dt>Interpretation</dt><dd>{observation ? 'LunaNav used the sign of each returned elevation angle to describe its position relative to 0°, the geometric horizon.' : 'There were no returned angles to compare to the geometric horizon.'} Checking for a terrain obstruction would require a separate horizon profile by azimuth.</dd></div>
      </dl>
    </details>
    {(terrain || response) && <details className="derivation-provenance"><summary>Sources and technical limitations</summary>
      {terrain && <>
        <p><a href={terrain.source_url}>{terrain.source_name}</a> · {terrain.coordinate_reference_system}</p>
        <p>Source SHA-256: {terrain.checksum}<br />Subset SHA-256: {terrain.subset_checksum}</p>
        <ul>{terrain.limitations.map(text => <li key={text}>{text}</li>)}</ul>
      </>}
      {response && <>
        <p><a href={response.provenance_url}>JPL Horizons provenance</a> · Live request executed: {response.live_request_executed ? 'yes' : 'no'}.</p>
        <ul>{response.limitation_explanation.map(text => <li key={text}>{text}</li>)}</ul>
      </>}
    </details>}
  </section>
}
