import { Compass, Layers3 } from 'lucide-react'
import { scenarioAssessments, scenarios, type AnalysisRequest, type DemoAnalysis } from '../data/mockData'
import type { TerrainSampleResult } from '../services/analysis'
import type { GeometryPanelState } from './SunEarthGeometryPanel'

const riskLabels = { pass: 'Favorable', caution: 'Review required', fail: 'Constrained' } as const

interface Props {
  analysis: DemoAnalysis
  analyzedRequest: AnalysisRequest
  request: AnalysisRequest
  siteName: string
  terrain: TerrainSampleResult | null
  terrainLoading: boolean
  geometry: GeometryPanelState | null
}

export function MissionDecision({ analysis, analyzedRequest, request, siteName, terrain, terrainLoading, geometry }: Props) {
  const assessment = scenarioAssessments[analyzedRequest.siteId]
  const risk = assessment?.status ?? 'caution'
  const dirty = JSON.stringify(request) !== JSON.stringify(analyzedRequest)
  const currentGeometry = geometry?.requestKey === JSON.stringify(request) ? geometry : null
  const response = currentGeometry?.response
  const realGeometry = !currentGeometry?.loading && response?.status === 'available'
    && response.live_request_executed && response.observation !== null
  const geometryLabel = currentGeometry?.loading ? 'Requesting geometry'
    : realGeometry ? 'Model-derived · JPL Horizons' : 'Demo/fallback data'
  const sample = !terrainLoading && terrain && !terrain.isFallback && !terrain.isOutOfCoverage
    && terrain.sample.mode === 'local-derived'
    && terrain.sample.coordinate_requested.latitude === request.latitude
    && terrain.sample.coordinate_requested.longitude === request.longitude ? terrain.sample : null

  return <section className="panel decision-panel" aria-labelledby="mission-decision-title">
    <div className="decision-heading">
      <div><h2 id="mission-decision-title"><Compass size={17} />Mission decision</h2>
        <p>{siteName} · {analyzedRequest.landingDate} · Illustrative comparison</p></div>
      <div className="decision-score"><strong>{analysis.feasibility}<small>/100</small></strong><span>Overall illustrative score</span></div>
      <span className={`assessment-badge ${risk}`}>Demo risk level: {riskLabels[risk]}</span>
    </div>
    {dirty && <p className="decision-pending" role="status">Selection changed. This score describes the last analyzed configuration; select Analyze Mission to refresh it.</p>}
    <div className="decision-quick">
      <h3>Quick view</h3>
      <p>{risk === 'pass' ? 'This demo scenario suggests a useful balance of sunlight and Earth visibility to explore further.'
        : risk === 'fail' ? 'This demo scenario illustrates more obstruction and less Earth visibility, so comparing another site or date is useful.'
          : assessment ? 'This demo scenario has less sunlight despite strong Earth visibility, so its tradeoffs need review.'
            : 'Custom coordinates use a fixed demo preset; real conditions at this location are still unknown.'}</p>
      <p className="decision-caveat">The score and risk label are preset educational comparisons, not scientific conclusions or a safety guarantee. Terrain and geometry results do not change this score.</p>
    </div>
    <details className="decision-technical">
      <summary>Technical view · sources, values &amp; limitations</summary>
      <dl className="decision-facts">
        <div><dt>Sunlight availability</dt><dd>{analysis.sunlight}% · demo fixture</dd></div>
        <div><dt>Earth visibility</dt><dd>{analysis.visibility}% · demo fixture, not RF availability</dd></div>
        <div><dt>Terrain obstruction</dt><dd>{analysis.obstruction}% · demo fixture, not a calculated horizon</dd></div>
        <div><dt>Comparison source</dt><dd>mockData.ts · fixed score; editorial scenario assessment, not a calculated risk threshold</dd></div>
        <div><dt>Geometry for current selection</dt><dd>{geometryLabel}{response && ` · provider status: ${response.status}`}</dd></div>
        {realGeometry && response?.observation && <div><dt>Geometry epoch / frame</dt><dd>{response.observation.timestamp_utc} · {response.observation.reference_frame}</dd></div>}
        <div><dt>Terrain for current selection</dt><dd>{terrainLoading ? 'Sampling terrain' : sample ? `${sample.elevation_value} ${sample.units} · local-derived elevation` : 'Demo/fallback data · no matching local-derived sample'}</dd></div>
        {sample && <>
          <div><dt>Terrain provenance</dt><dd>{sample.source_name} · {sample.product_name} {sample.product_version}</dd></div>
          <div><dt>Source URL</dt><dd>{sample.source_url}</dd></div>
          <div><dt>Sample location / datum</dt><dd>{sample.coordinate_used.latitude}°, {sample.coordinate_used.longitude}° · reference radius {sample.reference_radius_m} m</dd></div>
          <div><dt>Validation</dt><dd>{sample.validation.status}</dd></div>
          <div><dt>Subset SHA-256</dt><dd>{sample.subset_checksum}</dd></div>
        </>}
      </dl>
      <ul className="decision-limitations">
        <li>Model-derived directions do not establish terrain clearance, illumination duration, radio communication, or landing safety.</li>
        <li>Single-cell terrain and single-epoch geometry cannot establish conditions throughout the mission window.</li>
        {sample?.limitations.map((text, index) => <li key={`terrain-${index}`}>{text}</li>)}
        {response?.limitation_explanation.map((text, index) => <li key={`geometry-${index}`}>{text}</li>)}
      </ul>
    </details>
    <div className="decision-flow">
      <h3>How this result is formed</h3>
      <p>Planning workflow below: source results are displayed separately; the demo indicators and score are not derived from them.</p>
      <ol>
        <li><strong>Site/date</strong><span>Current user selection</span></li>
        <li><strong>Terrain sample</strong><span>{sample ? 'Local-derived LOLA' : terrainLoading ? 'Sampling terrain' : 'Demo/fallback data'}</span></li>
        <li><strong>Sun/Earth geometry</strong><span>{geometryLabel}</span></li>
        <li><strong>Obstruction/visibility indicators</strong><span>Fixed demo values</span></li>
        <li><strong>Illustrative comparison score</strong><span>Preset demo score · {analysis.feasibility}/100</span></li>
      </ol>
    </div>
    <ScenarioHeatmap />
  </section>
}

function ScenarioHeatmap() {
  return <div className="decision-heatmap">
    <h3><Layers3 size={15} />Illustrative scenario heatmap</h3>
    <p>Scenario comparisons, not a spatial map. Stronger shading means a larger demo value; lower obstruction is preferable. Risk labels reuse the existing editorial assessments.</p>
    <div className="table-scroll"><table>
      <caption className="sr-only">Fixed demo percentages and scores by scenario. These cells do not represent geographic coverage.</caption>
      <thead><tr><th>Scenario</th><th>Sunlight</th><th>Earth visibility</th><th>Obstruction</th><th>Score /100</th><th>Demo risk</th></tr></thead>
      <tbody>{scenarios.map(({ site, analysis }) => <tr key={site.id}>
        <th scope="row">{site.name}</th>
        {[analysis.sunlight, analysis.visibility, analysis.obstruction, analysis.feasibility].map((value, index) =>
          <td key={index}><span className="heatmap-cell" style={{ backgroundColor: `rgba(${index === 2 ? '180, 137, 225' : '45, 156, 186'}, ${0.08 + value / 200})` }}>{value}{index < 3 ? '%' : ''}</span></td>)}
        <td><span className={`assessment-badge ${scenarioAssessments[site.id].status}`}>{riskLabels[scenarioAssessments[site.id].status]}</span></td>
      </tr>)}</tbody>
    </table></div>
    <p className="decision-caveat">A validated heatmap requires terrain and geometry samples across a grid, plus validated analysis. These preset values provide no real spatial coverage.</p>
  </div>
}
