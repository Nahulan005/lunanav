import { useState } from 'react'
import type { SunEarthGeometryResponse, SunEarthObservation } from '../services/geometry'
import './scheduleTables.css'

function horizon(elevation: number) {
  if (elevation > 0) return 'Above'
  if (elevation < 0) return 'Below'
  return 'At horizon'
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toISOString().slice(0, 16).replace('T', ' ')
}

export function ScheduleTables({ response }: { response: SunEarthGeometryResponse }) {
  const [filter, setFilter] = useState<'all' | 'both'>('all')
  const samples = [...response.observations].sort((a, b) => Date.parse(a.timestamp_utc) - Date.parse(b.timestamp_utc))
  const step = /^'?(\d+)\s*m(?:in)?'?$/i.exec(response.request_parameters.sun_parameters.STEP_SIZE ?? '')
  const cadence = step ? Number(step[1]) * 60_000 : 0
  const periods: { start: SunEarthObservation; end: SunEarthObservation; sun: string; earth: string; count: number }[] = []

  for (const sample of samples) {
    const sun = horizon(sample.sun.elevation_deg)
    const earth = horizon(sample.earth.elevation_deg)
    const last = periods.at(-1)
    if (last && cadence > 0 && last.sun === sun && last.earth === earth
      && Date.parse(sample.timestamp_utc) - Date.parse(last.end.timestamp_utc) === cadence) {
      last.end = sample
      last.count++
    } else {
      periods.push({ start: sample, end: sample, sun, earth, count: 1 })
    }
  }

  const visible = filter === 'both' ? periods.filter(period => period.sun === 'Above' && period.earth === 'Above') : periods
  return <section className="panel mission-schedule-tables">
    <header>
      <div><h2>Sun & Earth schedule</h2><p>{samples.length} returned samples{cadence > 0 ? ` · ${cadence / 60_000} min cadence` : ''} · UTC</p></div>
      <label>Show <select value={filter} onChange={event => setFilter(event.target.value === 'both' ? 'both' : 'all')}>
        <option value="all">All sampled periods</option><option value="both">Sun and Earth both above</option>
      </select></label>
    </header>
    <p>Rows group consecutive samples with the same position relative to the 0° geometric horizon. Start and end are sample times. Terrain shadows and radio link availability require separate analysis.</p>
    <div className="mission-table-scroll" tabIndex={0} aria-label="Schedule table">
      <table><caption>Sampled geometric horizon periods</caption><thead><tr>
        <th scope="col">First sample (UTC)</th><th scope="col">Last sample (UTC)</th><th scope="col">Sun</th><th scope="col">Earth</th><th scope="col">Samples</th>
      </tr></thead><tbody>
        {visible.map(period => <tr key={period.start.timestamp_utc}>
          <td>{formatTime(period.start.timestamp_utc)}</td><td>{formatTime(period.end.timestamp_utc)}</td>
          <td><span data-horizon={period.sun}>{period.sun}</span></td><td><span data-horizon={period.earth}>{period.earth}</span></td><td>{period.count}</td>
        </tr>)}
        {!visible.length && <tr><td colSpan={5}>{samples.length ? 'No sampled periods match this filter.' : 'No observations were returned.'}</td></tr>}
      </tbody></table>
    </div>
    {samples.length > 0 && <details><summary>View all {samples.length} geometry samples</summary>
      <div className="mission-table-scroll mission-table-samples" tabIndex={0} aria-label="Horizons sample table">
        <table><caption>Individual JPL Horizons readings</caption><thead><tr><th scope="col">Time (UTC)</th><th scope="col">Sun azimuth</th><th scope="col">Sun elevation</th><th scope="col">Earth azimuth</th><th scope="col">Earth elevation</th></tr></thead>
        <tbody>{samples.map(sample => <tr key={sample.timestamp_utc}><td>{formatTime(sample.timestamp_utc)}</td>
          <td>{sample.sun.azimuth_deg.toFixed(2)}°</td><td>{sample.sun.elevation_deg.toFixed(2)}°</td>
          <td>{sample.earth.azimuth_deg.toFixed(2)}°</td><td>{sample.earth.elevation_deg.toFixed(2)}°</td>
        </tr>)}</tbody></table>
      </div>
    </details>}
  </section>
}
