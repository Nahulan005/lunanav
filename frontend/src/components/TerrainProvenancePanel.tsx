import { Mountain, ShieldCheck, Radio } from 'lucide-react'
import type { TerrainSampleResult } from '../services/analysis'

interface TerrainProvenancePanelProps {
  result: TerrainSampleResult
  loading?: boolean
  siteName: string
}

export function TerrainProvenancePanel({ result, loading, siteName }: TerrainProvenancePanelProps) {
  const { sample } = result
  const sourceName = sample.source_name
  const productName = `${sample.product_name} (${sample.product_version})`
  const elevation = `${sample.elevation_value.toFixed(1)}`
  const units = sample.units
  const coordinateUsed = `${sample.coordinate_used.latitude.toFixed(3)}° latitude, ${sample.coordinate_used.longitude.toFixed(3)}° east longitude`
  const validationStatus = sample.validation.status

  return (
    <section className="panel terrain-provenance-panel" aria-label="LOLA Terrain Provenance">
      <div className="section-heading">
        <div className="terrain-panel-title">
          <h2>
            <Mountain size={16} />
            <span>NASA LOLA Terrain Elevation Provenance</span>
          </h2>
          <p className="terrain-panel-subtitle">
            Audited PDS LDEM_4 topographic sample · {siteName}
          </p>
        </div>
        <div className="terrain-status-badges">
          {loading ? (
            <span className="small-badge">SAMPLING…</span>
          ) : (
            <span className="small-badge success">AUDITED LOLA SAMPLE</span>
          )}
        </div>
      </div>

      <div className="terrain-provenance-grid">
        <div className="provenance-field">
          <span className="field-label">Source Name</span>
          <strong className="field-value" title={sourceName}>
            {sourceName}
          </strong>
        </div>

        <div className="provenance-field">
          <span className="field-label">Product Name</span>
          <strong className="field-value">{productName}</strong>
        </div>

        <div className="provenance-field">
          <span className="field-label">Elevation</span>
          <strong className="field-value highlight-value">
            {elevation} {units}
            <small className="sample-indicator"> (sample)</small>
          </strong>
        </div>

        <div className="provenance-field">
          <span className="field-label">Units</span>
          <strong className="field-value">
            {units} <span className="units-note">(relative to {sample.reference_radius_m} m radius)</span>
          </strong>
        </div>

        <div className="provenance-field">
          <span className="field-label">Coordinate Used</span>
          <strong className="field-value">{coordinateUsed}</strong>
        </div>

        <div className="provenance-field">
          <span className="field-label">Validation Status</span>
          <div className="validation-pill" title={validationStatus}>
            <ShieldCheck size={12} />
            <span>{validationStatus}</span>
          </div>
        </div>
      </div>

      <dl className="provider-facts">
        <div><dt>Source URL</dt><dd>{sample.source_url}</dd></div>
        <div><dt>Coordinate frame / reference</dt><dd>{sample.coordinate_reference_system}</dd></div>
        <div><dt>Nodata interpretation</dt><dd>{sample.nodata_status}</dd></div>
        <div><dt>Subset SHA-256</dt><dd>{sample.subset_checksum}</dd></div>
      </dl>
      <details><summary>Product limitations</summary><ul>{sample.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></details>
      <div className="terrain-disclaimer">
        <ul className="terrain-limitations-list">
          <li>Real LOLA terrain available only for the current local coverage region.</li>
          <li>Coordinates outside coverage use clearly labeled demo fallback data.</li>
          <li>Single-cell elevation; no interpolation or RF link-budget calculation.</li>
        </ul>
        <div className="disclaimer-line">
          <Radio size={12} />
          <span>
            <strong>Communication Notice:</strong> Geometric Earth visibility does not establish radio communication or direct line-of-sight link availability.
          </span>
        </div>
      </div>
    </section>
  )
}
