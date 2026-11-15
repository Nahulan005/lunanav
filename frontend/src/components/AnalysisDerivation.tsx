import { Info } from 'lucide-react'
import type { AnalysisRequest } from '../data/mockData'
import type { TerrainSample } from '../services/analysis'
import type { GeometryPanelState } from './SunEarthGeometryPanel'

interface Props {
  request: AnalysisRequest
  siteName: string
  terrain: TerrainSample | null
  terrainLoading: boolean
  outsideCoverage: boolean
  geometry: GeometryPanelState | null
}

export function AnalysisDerivation({ request, siteName, terrain, terrainLoading, outsideCoverage, geometry }: Props) {
  // Do not explain a previous configuration as though it described this selection.
  const current = geometry?.requestKey === JSON.stringify(request) ? geometry : null
  const response = current?.response
  const observation = !current?.loading && response?.status === 'available' && response.live_request_executed
    ? response.observation : null
  const coordinate = (value: number) => Number.isFinite(value) ? `${value.toFixed(4)}°` : 'Unknown'
  const terrainStatus = terrainLoading ? 'Requesting sample'
    : terrain ? 'Returned local-derived elevation'
      : outsideCoverage ? 'Unavailable: outside local LOLA coverage' : 'Unavailable: no matching local-derived sample'
  const geometryStatus = current?.loading ? 'Requesting geometry'
    : observation ? 'Returned model-derived directions'
      : `Unavailable${response ? `: provider status ${response.status}` : ': no matching provider response'}`

  return <section className="panel derivation-panel" aria-labelledby="analysis-derivation-title">
    <div className="section-heading">
      <h2 id="analysis-derivation-title"><Info size={16} />How this result was derived</h2>
      <span className="small-badge">NOT EVALUATED</span>
    </div>
    <p className="tab-context-note">Suitability: <strong>Not evaluated.</strong> Available point data is context only; missing required inputs and unconfigured thresholds prevent a classification. Unknown is not a pass.</p>
    <dl className="derivation-steps">
      <div><dt>1 · Selection &amp; reference</dt><dd>
        {siteName}: {coordinate(request.latitude)} latitude / {coordinate(request.longitude)} east longitude; {request.landingDate || 'Unavailable date'} UTC date.
        <span>Terrain frame: {terrain?.coordinate_reference_system || 'Unavailable · no matching terrain metadata'}.</span>
        <span>Geometry frame: {observation?.reference_frame || 'Unavailable'}; observation UTC: {observation?.timestamp_utc || 'Unavailable · date selection alone does not specify an observation time'}.</span>
      </dd></div>
      <div><dt>2 · Sources returned</dt><dd>
        <span>LOLA: {terrainStatus}{terrain ? ` · ${terrain.product_name} ${terrain.product_version} · ${terrain.source_name}` : ''}.</span>
        <span>Horizons: {geometryStatus}{response ? ` · ${response.provider_name}` : ''}.</span>
        {response?.detail && !observation && <span>{response.detail}</span>}
      </dd></div>
      <div><dt>3 · Operations performed</dt><dd>
        <span>{terrain ? `Terrain provider reports: ${terrain.sampling_method}. Returned elevation: ${terrain.elevation_value} ${terrain.units}; sampled center: ${terrain.coordinate_used.latitude}°, ${terrain.coordinate_used.longitude}°.` : 'No matching terrain sampling result is available to explain.'}</span>
        <span>{observation ? 'The Horizons provider returned apparent Sun/Earth directions for the stated observer and epoch. The frontend checks the response and formats those angles for display.' : 'No matching available Horizons observation is used; no substitute geometry is calculated.'}</span>
        <span>The frontend does not combine these sources into a suitability score, terrain-cleared visibility, illumination duration, or communications result.</span>
      </dd></div>
      <div><dt>4 · Missing requirements</dt><dd>Validated site-scale slope, terrain horizon by azimuth, and configured mandatory thresholds/margins are unavailable in this view. Terrain-aware time-window results are also unavailable; point-in-time geometry cannot supply them.</dd></div>
      <div><dt>5 · Outcome</dt><dd>No suitability calculation ran. The selected location has no evaluated pass/fail classification, score, or justified recommendation. Fixed demo comparisons are confined to <a href="#/compare">Compare Scenarios</a>.</dd></div>
    </dl>
    {(terrain || response) && <details className="derivation-provenance"><summary>Returned provenance &amp; limitations</summary>
      {terrain && <>
        <p>Terrain source: {terrain.source_url}</p>
        <p>Reference radius: {terrain.reference_radius_m} m; nodata status: {terrain.nodata_status}; validation: {terrain.validation.status}. Acquisition timestamp: unavailable in the current response.</p>
        <p>Source SHA-256: {terrain.checksum}<br />Subset SHA-256: {terrain.subset_checksum}</p>
        <ul>{terrain.limitations.map((text, index) => <li key={`terrain-${index}`}>{text}</li>)}</ul>
      </>}
      {response && <>
        <p>Geometry provenance: {response.provenance_url}; live request executed: {response.live_request_executed ? 'yes (does not alone establish a successful result)' : 'no'}.</p>
        {observation && <p>Geometry reference surface: {observation.reference_ellipsoid}.</p>}
        <ul>{response.limitation_explanation.map((text, index) => <li key={`geometry-${index}`}>{text}</li>)}</ul>
      </>}
    </details>}
  </section>
}
