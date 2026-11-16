import { useId, useState } from 'react'
import type { ObservationStatus, Site04CoverageResponse } from './terrainGrid'

const states: { status: ObservationStatus; label: string; symbol: string }[] = [
  { status: 'observed', label: 'Observed: LOLA returns present', symbol: '+' },
  { status: 'unobserved', label: 'Unobserved: zero returns', symbol: '0' },
  { status: 'nodata', label: 'Nodata: missing / masked', symbol: '/' },
  { status: 'unverified', label: 'Unverified: invalid / unknown', symbol: '?' },
]

export function Site04CoverageGrid({ data, loading, error, onRetry }: { data: Site04CoverageResponse | null; loading: boolean; error?: string | null; onRetry?: () => void }) {
  const id = useId().replaceAll(':', '')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selected = data?.cells.find(cell => `${cell.row}-${cell.column}` === selectedKey) ?? data?.cells[0]
  const b = data?.returned_bounds
  const resolution = data?.returned_resolution
  const drawable = !loading && data && data.status !== 'unavailable' && data.cells.length > 0 && b && resolution
  const number = (value: number | null | undefined) => value == null ? 'Unavailable' : String(value)
  return <section className="site04-grid-panel" aria-labelledby={`${id}-title`} aria-busy={loading}>
    <div className="site04-grid-heading"><h3 id={`${id}-title`}>Site04 observation coverage</h3><span role="status">API status: {loading ? 'loading' : data?.status ?? 'unavailable'}</span></div>
    <p>Separate projected X/Y view. No latitude/longitude transformation is verified, so these cells are never placed on the Moon globe. This is observation coverage only, not landing suitability or risk.</p>
    {data && <p>{data.detail}</p>}
    {error && !loading && <p role="status">{error}</p>}
    {onRetry && <button type="button" className="moon3d-mode-button" onClick={onRetry} disabled={loading}>{loading ? 'Requesting coverage…' : 'Retry coverage request'}</button>}
    {!drawable && <p className="site04-empty">{loading ? 'Requesting the bounded coverage window.' : !data ? 'Coverage API unavailable or response invalid. No demo substitute.' : 'No observation cells available to display. No demo substitute.'}</p>}
    {drawable && <div className="site04-grid-layout">
      <figure>
        <svg viewBox="0 0 360 360" role="group" aria-labelledby={`${id}-plot-title ${id}-plot-desc`}>
          <title id={`${id}-plot-title`}>32 by 32 native Site04 observation-count cells</title>
          <desc id={`${id}-plot-desc`}>X increases right, Y increases up, in {resolution.units}. Observed pixels contain a plus; empty-count pixels are dark. Missing pixels are grey diagonal stripes; unverified pixels are grey crosshatch. Unreturned areas stay grey. Source grid only, without interpolation.</desc>
          <defs>
            <pattern id={`${id}-nodata`} width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#8899aa" /><path d="M0 5L5 0" stroke="#1b2835" /></pattern>
            <pattern id={`${id}-unverified`} width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#8899aa" /><path d="M0 0L5 5M0 5L5 0" stroke="#1b2835" /></pattern>
          </defs>
          <rect x="20" y="20" width="320" height="320" fill={`url(#${id}-unverified)`} />
          {data.cells.map((cell, index) => {
            const x = 20 + (cell.bounds.min_x-b.min_x)/(b.max_x-b.min_x)*320
            const y = 20 + (b.max_y-cell.bounds.max_y)/(b.max_y-b.min_y)*320
            const width = (cell.bounds.max_x-cell.bounds.min_x)/(b.max_x-b.min_x)*320
            const height = (cell.bounds.max_y-cell.bounds.min_y)/(b.max_y-b.min_y)*320
            const fill = cell.observation_status === 'observed' ? '#5ac9ed' : cell.observation_status === 'unobserved' ? '#152a3c' : `url(#${id}-${cell.observation_status})`
            const key = `${cell.row}-${cell.column}`
            const active = selected?.row === cell.row && selected?.column === cell.column
            return <g key={key} role="button" tabIndex={active ? 0 : -1} data-cell-index={index}
              className={`site04-cell${active ? ' is-selected' : ''}`} aria-pressed={active}
              aria-label={`Row ${cell.row}, column ${cell.column}: ${cell.observation_status}, ${cell.value ?? 'Unavailable'} ${cell.value_unit ?? ''}`}
              onClick={() => setSelectedKey(key)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSelectedKey(key)
                  return
                }
                const step = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: resolution.columns, ArrowUp: -resolution.columns } as Record<string, number>)[event.key]
                if (step === undefined) return
                event.preventDefault()
                const nextIndex = Math.max(0, Math.min(data.cells.length - 1, index + step))
                const next = data.cells[nextIndex]
                setSelectedKey(`${next.row}-${next.column}`)
                event.currentTarget.ownerSVGElement?.querySelector<SVGGElement>(`[data-cell-index="${nextIndex}"]`)?.focus()
              }}><title>Row {cell.row}, column {cell.column}: {cell.observation_status}; {cell.value ?? 'Unavailable'} {cell.value_unit ?? ''}; X {cell.bounds.min_x} to {cell.bounds.max_x}, Y {cell.bounds.min_y} to {cell.bounds.max_y} {resolution.units}</title>
              <rect x={x} y={y} width={width} height={height} fill={fill} stroke={active ? "#fff0b2" : "#577184"} strokeWidth={active ? "1.8" : "0.3"} />
              {cell.observation_status === 'observed' && <text x={x+width/2} y={y+height*0.8} textAnchor="middle" fill="#062133" fontSize="8">+</text>}
            </g>
          })}
          <text x="180" y="355" textAnchor="middle" fill="#becfdd" fontSize="10">X ({resolution.units}) increases right</text>
          <text transform="translate(10,180) rotate(-90)" textAnchor="middle" fill="#becfdd" fontSize="10">Y ({resolution.units}) increases up</text>
        </svg>
        <figcaption>{resolution.rows} x {resolution.columns} returned grid; {data.cells.length} source cells. Click or tap a cell for details. Keyboard: Tab into the grid, then use arrow keys.</figcaption>
      </figure>
      <div>
        <ul className="site04-status-legend" aria-label="Observation status legend">{states.map(state => <li key={state.status}><span className={`site04-swatch ${state.status}`} aria-hidden="true">{state.symbol}</span><span>{state.label}</span></li>)}</ul>
        {selected && <div className="site04-selected-cell" aria-live="polite" aria-atomic="true">
          <h4>Selected source cell</h4>
          <p>Row {selected.row}, column {selected.column} ? {selected.observation_status}</p>
          <strong>{selected.value ?? 'Unavailable'} {selected.value_unit ?? ''}</strong>
          <p>X {selected.bounds.min_x} to {selected.bounds.max_x} {resolution.units}<br />Y {selected.bounds.min_y} to {selected.bounds.max_y} {resolution.units}</p>
          <small>Native observation count; no interpolation or suitability classification.</small>
        </div>}
        <dl className="site04-facts">
          <div><dt>Returned X bounds</dt><dd>{b.min_x} to {b.max_x} {resolution.units}</dd></div>
          <div><dt>Returned Y bounds</dt><dd>{b.min_y} to {b.max_y} {resolution.units}</dd></div>
          <div><dt>Returned cell spacing</dt><dd>{resolution.x_spacing} x {resolution.y_spacing} {resolution.units}</dd></div>
          <div><dt>Native resolution</dt><dd>{data.native_resolution ? `${data.native_resolution.x_spacing} x ${data.native_resolution.y_spacing} ${data.native_resolution.units}` : 'Unavailable'}</dd></div>
          <div><dt>Observed / valid pixels</dt><dd>{number(data.summary.observed_pixel_count)} / {number(data.summary.valid_pixel_count)}</dd></div>
          <div><dt>Observed percentage (window only)</dt><dd>{data.summary.coverage_percentage == null ? 'Unavailable' : `${data.summary.coverage_percentage}%`}</dd></div>
          <div><dt>Nodata / unverified pixels</dt><dd>{number(data.summary.nodata_pixel_count)} / {number(data.summary.unverified_pixel_count)}</dd></div>
        </dl>
      </div>
    </div>}
    {data && <details className="site04-provenance"><summary>Source, coordinate frame and limitations</summary>
      <dl className="site04-facts"><div><dt>Product / instrument</dt><dd>{data.source.expected_product} / {data.source.instrument}</dd></div><div><dt>Source URL</dt><dd>{data.source.product_url ?? 'Unavailable'}</dd></div><div><dt>Source SHA-256</dt><dd>{data.source.sha256 ?? 'Unavailable'}</dd></div><div><dt>Processing / validation</dt><dd>{data.source.processing_version ?? 'Unavailable'} / {data.source.validation}</dd></div><div><dt>Frame / projection</dt><dd>{data.coordinate_system.frame ?? 'Unavailable'} / {data.coordinate_system.projection ?? 'Unavailable'}</dd></div><div><dt>Value units / nodata policy</dt><dd>{data.value_unit ?? 'Unavailable'} / {data.nodata_status}</dd></div></dl>
      <p>{data.summary.observation_rule ?? 'Observation semantics unavailable'}</p><p>{data.summary.percentage_definition}</p>
      <ul>{data.limitations.map((text,i)=><li key={i}>{text}</li>)}</ul>
    </details>}
  </section>
}
