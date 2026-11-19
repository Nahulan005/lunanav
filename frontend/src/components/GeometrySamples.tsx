import { useState } from 'react'
import type { GeometryPanelState } from './SunEarthGeometryPanel'

export function GeometrySamples({ state }: { state: GeometryPanelState | null }) {
  const [index, setIndex] = useState(0)
  const response = state?.response
  const samples = response?.status === 'available' && response.live_request_executed ? response.observations : []
  const times = samples.map(sample => Date.parse(sample.timestamp_utc))
  const first = Math.min(...times), last = Math.max(...times)
  const current = samples[Math.min(index, samples.length - 1)]
  return <section className="panel schedule-samples" aria-label="Returned geometry sample explorer">
    <div className="section-heading"><h2>Geometry sample explorer</h2><span className="small-badge">{samples.length} RETURNED SAMPLES</span></div>
    <p>Point-in-time apparent directions. No terrain-aware schedule or communications windows are calculated.</p>
    {samples.length > 0 ? <>
      <svg viewBox="0 0 800 245" role="img" aria-label="Discrete returned Sun and Earth elevations in degrees versus UTC time" className="sample-chart">
        {[-90, -45, 0, 45, 90].map(deg => <g key={deg}><line x1="48" x2="775" y1={110 - deg} y2={110 - deg} stroke="#294251" /><text x="4" y={114 - deg} fill="#a4b9c9" fontSize="12">{deg}°</text></g>)}
        {samples.map((sample, i) => <g key={`${sample.timestamp_utc}-${i}`}><circle cx={last === first ? 410 : 48 + (times[i] - first) / (last - first) * 727} cy={110 - sample.sun.elevation_deg} r="3" fill="#eec47c" /><circle cx={last === first ? 410 : 48 + (times[i] - first) / (last - first) * 727} cy={110 - sample.earth.elevation_deg} r="3" fill="#6bdded" /></g>)}
        <text x="48" y="230" fill="#a4b9c9" fontSize="11">{samples[0].timestamp_utc}</text><text x="775" y="230" textAnchor="end" fill="#a4b9c9" fontSize="11">{samples.length > 1 ? samples[samples.length - 1].timestamp_utc : 'Single observation'}</text>
      </svg>
      <div className="sample-legend"><span>● Sun elevation</span><span>● Earth centre elevation</span><span>Time (UTC) · gaps are not interpolated</span></div>
      <label htmlFor="sample-inspect">Inspect returned sample</label><input id="sample-inspect" type="range" min="0" max={samples.length - 1} value={Math.min(index, samples.length - 1)} onChange={event => setIndex(Number(event.target.value))} />
      <p>{current?.timestamp_utc} · Sun {current?.sun.elevation_deg.toFixed(2)}° · Earth {current?.earth.elevation_deg.toFixed(2)}°</p><p>Source: {response?.provider_name} · {current?.reference_frame}</p>
    </> : <div className="schedule-empty"><span>—</span><strong>{state?.loading ? 'Requesting provider geometry' : 'No returned time series available'}</strong><p>No substitute chart or demo samples are shown. The provider panel below reports the current response.</p></div>}
  </section>
}
