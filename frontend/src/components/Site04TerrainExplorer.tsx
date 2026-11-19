import { useEffect, useState } from 'react'
import { fetchSite04Footprint, fetchSite04Terrain, type GeographicPoint, type Site04Terrain, type Site04Footprint, type Site04Cell } from '../services/site04Terrain'
import './site04Terrain.css'

export function Site04TerrainExplorer({ point, onSelect }: { point: GeographicPoint; onSelect: (point: GeographicPoint) => void }) {
  const [footprint, setFootprint] = useState<Site04Footprint | null>(null)
  const [data, setData] = useState<Site04Terrain | null>(null)
  const [selected, setSelected] = useState<Site04Cell | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const [layer, setLayer] = useState<'elevation' | 'slope'>('elevation')
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => { setError('Site04 request timed out. Retry to check again.'); controller.abort() }, 15000)
    setData(null); setSelected(null); setLoading(true); setError('')
    fetchSite04Footprint(controller.signal).then(value => { if (!controller.signal.aborted) setFootprint(value) }).catch(() => {})
    fetchSite04Terrain(point, controller.signal).then(value => {
      if (!controller.signal.aborted) { setData(value); setSelected(value.cells.find(cell => cell.row === value.selection?.row && cell.column === value.selection?.column) ?? null) }
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Site04 unavailable.') })
      .finally(() => { if (!controller.signal.aborted) { setLoading(false); window.clearTimeout(timer) } })
    controller.signal.addEventListener('abort', () => { setLoading(false) }, { once: true })
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [point.latitude, point.longitude, retry])
  const cells = data?.cells ?? []
  const values = cells.flatMap(cell => cell[layer].status === 'available' && cell[layer].value !== null ? [cell[layer].value!] : [])
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 0
  const bounds = data?.returned_bounds
  const format = (metric: Site04Cell['elevation']) => metric.status === 'available' && metric.value !== null ? `${metric.value.toFixed(3)} ${metric.unit}` : `Unavailable · ${metric.status}`
  return <section className="panel site04-terrain-explorer" aria-label="Site04 real terrain explorer" aria-busy={loading}>
    <header><div><h2>Explore Site04 terrain</h2><p>Native LOLA elevation and slope products · provisional · no suitability evaluation</p></div><span role="status">{loading ? 'Requesting window' : data?.status ?? 'Unavailable'}</span></header>
    <div className="site04-terrain-actions">
      <button type="button" disabled={!footprint} onClick={() => footprint && onSelect(footprint.center)}>Explore Site04 centre</button>
      <button type="button" onClick={() => setRetry(value => value+1)}>Retry</button>
      <label>Data layer <select value={layer} onChange={event => setLayer(event.target.value as typeof layer)}><option value="elevation">Surface elevation (m)</option><option value="slope">NASA slope (degrees)</option></select></label>
    </div>
    <p>Selected: {point.latitude.toFixed(6)}° latitude / {point.longitude.toFixed(6)}° east longitude</p>
    {footprint && <details><summary>Source footprint and navigation</summary><p>{footprint.frame}. X {footprint.projected_bounds.min_x} to {footprint.projected_bounds.max_x} m; Y {footprint.projected_bounds.min_y} to {footprint.projected_bounds.max_y} m.</p>
      <p>Click the grey footprint to request a native window there. Grey is unqueried coverage, not a measured terrain value.</p>
      <svg viewBox="0 0 320 320" className="site04-footprint" role="img" aria-label="Site04 projected source footprint; selected window outlined in cyan" onClick={event => {
        const rect=event.currentTarget.getBoundingClientRect(); const b=footprint.projected_bounds
        const x=b.min_x+(event.clientX-rect.left)/rect.width*(b.max_x-b.min_x)
        const y=b.max_y-(event.clientY-rect.top)/rect.height*(b.max_y-b.min_y)
        onSelect({latitude:-90+2*Math.atan2(Math.hypot(x,y),2*1737400)*180/Math.PI,longitude:Math.atan2(x,y)*180/Math.PI})
      }}><rect width="320" height="320" fill="#59616c" />{bounds && <rect x={(bounds.min_x+9000)/50} y={(1000-bounds.max_y)/50} width={(bounds.max_x-bounds.min_x)/50} height={(bounds.max_y-bounds.min_y)/50} fill="none" stroke="#59d9ef" strokeWidth="2" />}</svg>
      <p>{footprint.limitation} Use the coordinate controls in Lunar Map for keyboard entry; the centre button is also keyboard accessible.</p></details>}
    {error && <p role="alert">{error}</p>}
    {!loading && !cells.length && <p className="site04-terrain-empty">{data?.detail ?? (error || 'No regional data returned. Check backend configuration.')} No demo terrain is substituted.</p>}
    {!!cells.length && bounds && <div className="site04-terrain-layout"><div>
      <svg viewBox="0 0 320 320" role="group" aria-label={`Native ${layer} cells; select a cell for source values`}>
        {cells.map(cell => {
          const metric=cell[layer]; const fraction=metric.value === null || max===min ? .5 : (metric.value-min)/(max-min)
          const fill=metric.status !== 'available' ? '#737984' : `hsl(${layer==='slope' ? 35 : 195} 45% ${25+fraction*50}%)`
          return <rect key={`${cell.row}-${cell.column}`} x={(cell.bounds.min_x-bounds.min_x)/(bounds.max_x-bounds.min_x)*320} y={(bounds.max_y-cell.bounds.max_y)/(bounds.max_y-bounds.min_y)*320} width="10" height="10" fill={fill} stroke={selected===cell ? '#fff' : '#101d28'} strokeWidth={selected===cell ? 2 : .3} role="button" tabIndex={0} aria-label={`Row ${cell.row}, column ${cell.column}: ${format(metric)}`} onClick={() => setSelected(cell)} onKeyDown={event => { if (event.key==='Enter'||event.key===' ') { event.preventDefault();setSelected(cell) } }}><title>{format(metric)}</title></rect>
        })}
      </svg>
      <p>Low {min.toFixed(2)} → high {max.toFixed(2)} {layer==='slope' ? 'degrees' : 'm'} · grey: missing/unverified. Colours show product magnitude, not risk.</p>
      <p>X {bounds.min_x}..{bounds.max_x} m · Y {bounds.min_y}..{bounds.max_y} m · {data?.returned_resolution?.x_spacing} m native spacing.</p>
    </div><div aria-live="polite">{selected && <><h3>Cell {selected.row}, {selected.column}</h3><dl>{(['elevation','slope','elevation_rms_uncertainty','slope_rms_uncertainty'] as const).map(key=><div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{format(selected[key])}</dd></div>)}<div><dt>LOLA observation</dt><dd>{selected.observation_status}</dd></div></dl><p>SURF includes NASA interpolation. A surface value can exist where no direct LOLA return was recorded.</p></>}</div></div>}
    {data && <details><summary>Provenance and remaining limitations</summary><p>{data.mapping_status}</p><p>{data.elevation_reference}</p><ul>{data.limitations.map(item=><li key={item}>{item}</li>)}</ul><ul>{data.sources.map(source=><li key={source.product}><a href={source.url}>{source.product}</a><br /><code>{source.sha256}</code></li>)}</ul></details>}
  </section>
}
