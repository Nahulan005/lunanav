import { useState } from 'react'
import type { GeometryPanelState } from './SunEarthGeometryPanel'

/** Plot returned observations only; no interpolated windows or gap filling. */
export function GeometryTimeline({ geometry }: { geometry: GeometryPanelState | null }) {
  const [selected, setSelected] = useState(0)
  const response = geometry?.response
  const samples = !geometry?.loading && response?.status === 'available' && response.live_request_executed
    ? [...response.observations].sort((a, b) => Date.parse(a.timestamp_utc) - Date.parse(b.timestamp_utc)) : []
  const sample = samples[Math.min(selected, Math.max(0, samples.length - 1))]
  const times = samples.map(s => Date.parse(s.timestamp_utc))
  const start = times[0], end = times.at(-1)
  const utc = (value: string) => new Date(value).toISOString().replace('T', ' ').replace('.000Z', ' UTC')
  return <section className="panel geometry-series" aria-label="Returned geometry samples">
    <h2>Sun / Earth geometry samples</h2>
    <p className="tab-context-note">Model-derived apparent elevation angles. Dots are returned observations, not continuous visibility or communication windows. Gaps are not interpolated.</p>
    {!sample || start === undefined || end === undefined ? <p className="unavailable-message">{geometry?.loading ? 'Requesting geometry samples.' : 'No returned geometry series available. No demo chart is substituted.'}</p> : <>
      <svg viewBox="0 0 740 265" role="img" aria-label="Returned Sun and Earth elevation samples versus UTC time" style={{ width: '100%', display: 'block' }}>
        {[-90, -45, 0, 45, 90].map(angle => <g key={angle}><line x1="60" x2="700" y1={120-angle} y2={120-angle} stroke={angle === 0 ? '#7d9bad' : '#284051'} /><text x="48" y={124-angle} textAnchor="end" fontSize="11" fill="#b4c8d7">{angle}°</text></g>)}
        {samples.map((s, i) => <g key={`${s.timestamp_utc}-${i}`}>
          <circle cx={start === end ? 380 : 60+(times[i]-start)/(end-start)*640} cy={120-s.sun.elevation_deg} r="3" fill="#f5c563"><title>Sun {utc(s.timestamp_utc)}: {s.sun.elevation_deg} degrees</title></circle>
          <circle cx={start === end ? 380 : 60+(times[i]-start)/(end-start)*640} cy={120-s.earth.elevation_deg} r="3" fill="#67d5ed"><title>Earth {utc(s.timestamp_utc)}: {s.earth.elevation_deg} degrees</title></circle>
        </g>)}
        <text x="60" y="233" fontSize="10" fill="#b4c8d7">{samples[0].timestamp_utc.slice(0,16).replace('T',' ')}</text><text x="700" y="233" textAnchor="end" fontSize="10" fill="#b4c8d7">{samples.at(-1)?.timestamp_utc.slice(0,16).replace('T',' ')}</text>
        <text x="380" y="258" textAnchor="middle" fontSize="11" fill="#b4c8d7">Time (UTC)</text><text transform="translate(14,125) rotate(-90)" textAnchor="middle" fontSize="11" fill="#b4c8d7">Elevation (degrees)</text>
      </svg>
      <p className="tab-context-note"><span style={{color:'#f5c563'}}>● Sun</span> / <span style={{color:'#67d5ed'}}>● Earth centre</span> · {samples.length} returned samples · source: {response?.provider_name}</p>
      <label htmlFor="geometry-sample-index">Inspect returned sample: {utc(sample.timestamp_utc)}</label>
      <input id="geometry-sample-index" type="range" min="0" max={Math.max(0,samples.length-1)} step="1" value={Math.min(selected,samples.length-1)} onChange={e=>setSelected(e.target.valueAsNumber)} disabled={samples.length<2} style={{width:'100%'}} />
      <p>Sun: {sample.sun.azimuth_deg.toFixed(2)}° azimuth / {sample.sun.elevation_deg.toFixed(2)}° elevation. Earth: {sample.earth.azimuth_deg.toFixed(2)}° azimuth / {sample.earth.elevation_deg.toFixed(2)}° elevation.</p>
      <p className="tab-context-note">Frame: {sample.reference_frame} · Reference: {sample.reference_ellipsoid}. Zero elevation is a geometry reference, not the measured terrain horizon. No illumination duration, RF availability or landing-safety inference.</p>
    </>}
  </section>
}
