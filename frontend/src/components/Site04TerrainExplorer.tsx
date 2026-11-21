import { useState } from 'react'
import { Site04ExtentView } from '../features/moon3d/Site04ExtentView'
import { useSite04Footprint, useSite04Terrain } from '../services/useSite04Terrain'
import type { GeographicPoint, Site04Cell } from '../services/site04Terrain'
import './site04Terrain.css'

const metrics = [
  ['elevation', 'Surface elevation'],
  ['slope', 'Slope'],
  ['elevation_rms_uncertainty', 'Elevation RMS uncertainty'],
  ['slope_rms_uncertainty', 'Slope RMS uncertainty'],
] as const

function format(metric: Site04Cell['elevation']) {
  return metric.status === 'available' && metric.value !== null
    ? `${metric.value.toFixed(3)} ${metric.unit === 'degree' ? '°' : 'm'}` : `Unavailable · ${metric.status}`
}

export function Site04TerrainExplorer() {
  const [point, setPoint] = useState<GeographicPoint | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [layer, setLayer] = useState<'elevation' | 'slope'>('elevation')
  const terrain = useSite04Terrain(true, point)
  const footprint = useSite04Footprint(true)
  const { data, loading } = terrain
  const cells = data?.cells ?? []
  const selected = cells[Math.min(selectedIndex, cells.length - 1)]
  const values = cells.flatMap(cell => cell[layer].status === 'available' && cell[layer].value !== null ? [cell[layer].value] : [])
  const low = Math.min(...values), high = Math.max(...values)
  const bounds = data?.returned_bounds

  function selectPatch(location: GeographicPoint | null) {
    setSelectedIndex(0)
    setPoint(location)
  }

  return <section className="panel site04-terrain-explorer" aria-label="Site04 terrain explorer" aria-busy={loading}>
    <header><div><h2>Explore Site04 terrain</h2><p>NASA LOLA elevation and slope near the lunar south pole.</p></div>
      <span className="small-badge">{loading ? 'Loading patch' : data?.status === 'provisional' ? 'Provisional data' : 'Unavailable'}</span></header>
    <p>{point ? `Requested patch at ${point.latitude.toFixed(6)}° latitude, ${point.longitude.toFixed(6)}° east longitude.`
      : 'Prepared centre patch · 160 × 160 m at 5 m spacing.'}</p>
    <div className="site04-terrain-actions">
      {point && <button type="button" onClick={() => selectPatch(null)}>Return to centre patch</button>}
      {!loading && !cells.length && <button type="button" onClick={terrain.retry}>Retry terrain</button>}
      <a href="#/landing-3d/site04">Open centre patch in 3D</a>
      {!!cells.length && <label>Layer <select value={layer} onChange={event => setLayer(event.target.value as typeof layer)}>
        <option value="elevation">Surface elevation (m)</option><option value="slope">Slope (°)</option>
      </select></label>}
    </div>
    {!loading && !cells.length && <p className="site04-terrain-empty" role="status">{terrain.error ?? data?.detail ?? 'No terrain samples returned.'}</p>}
    {!!cells.length && bounds && <div className="site04-terrain-layout">
      <figure>
        <svg viewBox="0 0 320 320" role="img" aria-label={`Site04 ${layer} samples. Choose a cell below or click the grid for values.`}>
          {cells.map((cell, index) => {
            const metric = cell[layer]
            const fraction = metric.value === null || high === low ? .5 : (metric.value - low) / (high - low)
            const fill = metric.status !== 'available' ? '#737984' : `hsl(${layer === 'slope' ? 35 : 195} 45% ${25 + fraction * 50}%)`
            return <rect key={`${cell.row}-${cell.column}`}
              x={(cell.bounds.min_x - bounds.min_x) / (bounds.max_x - bounds.min_x) * 320}
              y={(bounds.max_y - cell.bounds.max_y) / (bounds.max_y - bounds.min_y) * 320}
              width={(cell.bounds.max_x - cell.bounds.min_x) / (bounds.max_x - bounds.min_x) * 320}
              height={(cell.bounds.max_y - cell.bounds.min_y) / (bounds.max_y - bounds.min_y) * 320}
              fill={fill} stroke={selected === cell ? '#fff' : '#101d28'} strokeWidth={selected === cell ? 2 : .3}
              onClick={() => setSelectedIndex(index)}><title>{format(metric)}</title></rect>
          })}
        </svg>
        <figcaption>{values.length ? `${low.toFixed(2)} to ${high.toFixed(2)} ${layer === 'slope' ? '°' : 'm'} · dark to light` : 'This layer has no valid values in the patch.'} · grey means missing or unverified.</figcaption>
      </figure>
      <div>
        <label>Inspect a source cell <select value={selectedIndex} onChange={event => setSelectedIndex(Number(event.target.value))}>
          {cells.map((cell, index) => <option key={`${cell.row}-${cell.column}`} value={index}>Row {cell.row}, column {cell.column}</option>)}
        </select></label>
        {selected && <dl aria-live="polite">{metrics.map(([key, name]) => <div key={key}><dt>{name}</dt><dd>{format(selected[key])}</dd></div>)}
          <div><dt>LOLA returns</dt><dd>{selected.observation_status}</dd></div>
        </dl>}
      </div>
    </div>}
    <details><summary>Explore the Site04 footprint</summary>
      {footprint.data ? <Site04ExtentView footprint={footprint.data} data={data} onSelect={selectPatch} /> :
        <><p>{footprint.loading ? 'Loading source footprint…' : footprint.error}</p>
          {!footprint.loading && <button type="button" onClick={footprint.retry}>Retry footprint</button>}</>}
    </details>
    {data?.sources.length ? <details><summary>Source products and limitations</summary>
      <p>NASA’s surface model includes interpolated values between direct LOLA returns. Values shown here describe the source terrain products.</p>
      <p>{data.mapping_status} {data.elevation_reference}</p>
      <ul>{data.limitations.map(item => <li key={item}>{item}</li>)}</ul>
      <ul>{data.sources.map(source => <li key={source.product}><a href={source.url}>{source.product}</a><br /><code>{source.sha256}</code></li>)}</ul>
    </details> : null}
  </section>
}
