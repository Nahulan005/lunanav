import { useEffect, useRef, useState } from 'react'
import type { TargetDirection } from '../services/geometry'
import type { GeometryPanelState } from './SunEarthGeometryPanel'
import './geometryTimeline.css'

const utc = (timestamp: string) => new Date(timestamp).toISOString().replace('T', ' ').replace('.000Z', ' UTC')
const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}°`

function elevationScale(values: number[]) {
  const min = Math.min(...values), max = Math.max(...values)
  const target = Math.max((max - min) / 4, 0.01)
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const step = ([1, 2, 5, 10].find(n => n * magnitude >= target) ?? 10) * magnitude
  const start = Math.floor((min - step / 2) / step)
  const end = Math.ceil((max + step / 2) / step)
  const digits = Math.max(0, Math.round(-Math.log10(magnitude)))
  return { step, digits, ticks: Array.from({ length: end - start + 1 }, (_, i) => (start + i) * step) }
}

function ElevationPlot({ name, color, values, positions, times, cadence, selected, width, onSelect }: {
  name: string; color: string; values: number[]; positions: number[]; times: number[]
  cadence: number; selected: number; width: number; onSelect: (index: number) => void
}) {
  const { step, digits, ticks } = elevationScale(values)
  const low = ticks[0], high = ticks[ticks.length - 1]
  const y = (value: number) => 112 - (value - low) / (high - low) * 100
  const path = values.map((value, i) => {
    const connect = i > 0 && cadence > 0 && times[i] - times[i - 1] === cadence
    return `${connect ? 'L' : 'M'} ${positions[i]} ${y(value)}`
  }).join(' ')
  return <div className="elevation-plot">
    <div className="elevation-plot-heading">
      <h3><span style={{ color }} aria-hidden="true">●</span> {name} elevation</h3>
      <p>Zoomed scale · one vertical division = {step.toFixed(digits)}°</p>
    </div>
    <svg viewBox={`0 0 ${width} 124`} height="124" role="img" aria-label={`${name} elevation in degrees. Selected sample: ${values[selected].toFixed(2)} degrees.`}
      onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect()
        const x = (event.clientX - rect.left) / rect.width * width
        onSelect(positions.reduce((best, point, i) => Math.abs(point - x) < Math.abs(positions[best] - x) ? i : best, 0))
      }}>
      {ticks.map(tick => <g key={tick}>
        <line x1="61" x2={width - 12} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#87a9bf' : '#284353'} strokeDasharray={tick === 0 ? '4 3' : undefined} />
        <text x="54" y={y(tick) + 4} textAnchor="end" fill="#b4c8d7" fontSize="13">{tick.toFixed(digits)}°</text>
      </g>)}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
      {values.map((value, i) => <circle key={i} cx={positions[i]} cy={y(value)} r="1.25" fill={color} />)}
      <line x1={positions[selected]} x2={positions[selected]} y1="6" y2="118" stroke="#f2f9ff" strokeDasharray="3 3" data-sample-cursor="true" />
      <circle cx={positions[selected]} cy={y(values[selected])} r="4.5" fill={color} stroke="#f2f9ff" strokeWidth="1.5" />
    </svg>
  </div>
}

function Reading({ name, direction, baseline }: { name: string; direction: TargetDirection; baseline: TargetDirection }) {
  return <div className="geometry-sample-reading">
    <h3>{name}</h3>
    <dl>
      <div><dt>Elevation</dt><dd>{direction.elevation_deg.toFixed(2)}°</dd></div>
      <div><dt>Azimuth</dt><dd>{direction.azimuth_deg.toFixed(2)}°</dd></div>
      <div><dt>Change from first sample</dt><dd>{signed(direction.elevation_deg - baseline.elevation_deg)}</dd></div>
    </dl>
  </div>
}

export function GeometryTimeline({ geometry }: { geometry: GeometryPanelState | null }) {
  const [index, setIndex] = useState(0)
  const [width, setWidth] = useState(520)
  const charts = useRef<HTMLDivElement>(null)
  const response = geometry?.response
  const samples = !geometry?.loading && response?.status === 'available' && response.live_request_executed
    ? [...response.observations].sort((a, b) => Date.parse(a.timestamp_utc) - Date.parse(b.timestamp_utc)) : []
  const selected = Math.min(index, samples.length - 1)
  const sample = samples[selected], first = samples[0], last = samples.at(-1)
  const hasSamples = Boolean(sample)
  useEffect(() => {
    if (!hasSamples || !charts.current) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(charts.current)
    return () => observer.disconnect()
  }, [hasSamples])
  const times = samples.map(s => Date.parse(s.timestamp_utc))
  const start = times[0], span = (times.at(-1) ?? start) - start
  const positions = times.map(time => span > 0 ? 61 + (time - start) / span * (width - 73) : (width + 49) / 2)
  const step = /^'?(\d+)\s*m(?:in)?'?$/i.exec(response?.request_parameters.sun_parameters.STEP_SIZE ?? '')
  const cadence = step ? Number(step[1]) * 60_000 : 0
  const plot = { positions, times, cadence, selected, width, onSelect: setIndex }

  return <section className="panel geometry-series" aria-label="Returned geometry samples">
    <h2>Sun and Earth elevation over time</h2>
    {!sample || !first || !last ? <p className="unavailable-message">{geometry?.loading ? 'Requesting geometry samples…' : response?.detail ?? geometry?.error ?? 'No geometry samples returned. Check the provider status above.'}</p> : <>
      <p className="tab-context-note">{samples.length} Horizons samples · {cadence ? `Requested every ${cadence / 60_000} minutes` : 'Returned timestamps only'}.</p>
      <p className="tab-context-note">Each plot uses its own degree scale. Dots mark returned samples. Lines join consecutive samples at the requested cadence, with breaks at gaps.</p>
      <div ref={charts}>
        <ElevationPlot {...plot} name="Sun centre" color="#f5c563" values={samples.map(s => s.sun.elevation_deg)} />
        <ElevationPlot {...plot} name="Earth centre" color="#67d5ed" values={samples.map(s => s.earth.elevation_deg)} />
        <div className="geometry-time-axis"><span>{utc(first.timestamp_utc)}</span>{samples.length > 1 && <span>{utc(last.timestamp_utc)}</span>}</div>
      </div>
      <div className="geometry-time-picker">
        <label htmlFor="geometry-sample-index">Selected time <strong>{utc(sample.timestamp_utc)}</strong></label>
        <input id="geometry-sample-index" type="range" min="0" max={samples.length - 1} step="1" value={selected}
          aria-valuetext={utc(sample.timestamp_utc)} onChange={event => setIndex(event.target.valueAsNumber)} disabled={samples.length < 2} />
        <small>Drag the slider, use arrow keys, or click a plot to move both cursors.</small>
      </div>
      <div className="geometry-sample-readings">
        <Reading name="Sun centre" direction={sample.sun} baseline={first.sun} />
        <Reading name="Earth centre" direction={sample.earth} baseline={first.earth} />
      </div>
      <p className="tab-context-note">Changes use the full precision of the returned angles before rounding. Elevation is relative to the reference sphere’s geometric horizon (0°). Terrain clearance and radio link performance require separate calculations.</p>
      <details><summary>Geometry source and reference</summary><p>{response?.provider_name} · {sample.reference_frame} · {sample.reference_ellipsoid}</p></details>
    </>}
  </section>
}
