
import type { FormEvent } from 'react'
import { Clock3, Globe2, MapPin, Sun } from 'lucide-react'
import type { AnalysisRequest } from '../data/mockData'
import type { GeometryPanelState } from './SunEarthGeometryPanel'

interface ScheduleManagerProps {
  request: AnalysisRequest
  siteName: string
  geometry: GeometryPanelState | null
  loading: boolean
  onDateChange: (date: string) => void
  onAnalyze: (event: FormEvent<HTMLFormElement>) => void
}

export function ScheduleManager({
  request,
  siteName,
  geometry,
  loading,
  onDateChange,
  onAnalyze,
}: ScheduleManagerProps) {
  const response = geometry?.response
  const observation =
    response?.status === 'available' &&
    response.live_request_executed &&
    response.observation
      ? response.observation
      : null

  const angle = (value: number | undefined) =>
    value === undefined ? 'Unavailable' : `${value.toFixed(2)}°`

  return (
    <section className="workspace-view" data-workspace-page="schedule" aria-label="Mission Schedule">
      <div className="workspace-section-label">
        <span>MISSION SCHEDULE</span>
        <p>Landing configuration · geometry context · schedule availability</p>
      </div>

      <form className="panel schedule-controls" onSubmit={onAnalyze}>
        <h2><Clock3 size={17} /> Configure mission date</h2>

        <div className="schedule-site-context">
          <p><MapPin size={14} /> Selected landing site</p>
          <strong>{siteName}</strong>
          <span>
            {request.latitude.toFixed(4)}° / {request.longitude.toFixed(4)}°
          </span>
        </div>

        <label htmlFor="landing-date">Landing date <span>UTC</span></label>
        <input
          id="landing-date"
          type="date"
          disabled={loading}
          required
          value={request.landingDate}
          onChange={(event) => onDateChange(event.target.value)}
        />

        <p className="unavailable-message">
          <strong>Real schedule windows unavailable.</strong>
          No verified terrain-aware illumination or geometric visibility
          windows are supplied by the current API. Point-in-time geometry
          does not establish a schedule.
        </p>

        <button type="submit" className="analyze-button" disabled={loading}>
          {loading ? 'Analyzing…' : 'Analyze Mission'}
        </button>
      </form>

      <section className="panel schedule-geometry" aria-label="Point-in-time geometry context">
        <div className="section-heading">
          <h2><Sun size={17} /> Sun & Earth geometry context</h2>
          <span className="small-badge">
            {geometry?.loading
              ? 'REQUESTING'
              : observation
                ? 'MODEL-DERIVED'
                : 'UNAVAILABLE'}
          </span>
        </div>

        {observation ? (
          <>
            <p className="geometry-epoch">
              UTC observation: {new Date(observation.timestamp_utc).toISOString()}
            </p>
            <div className="geometry-readings">
              <div><Sun size={15} /><span>Sun azimuth<strong>{angle(observation.sun.azimuth_deg)}</strong></span></div>
              <div><Sun size={15} /><span>Sun elevation<strong>{angle(observation.sun.elevation_deg)}</strong></span></div>
              <div><Globe2 size={15} /><span>Earth azimuth<strong>{angle(observation.earth.azimuth_deg)}</strong></span></div>
              <div><Globe2 size={15} /><span>Earth elevation<strong>{angle(observation.earth.elevation_deg)}</strong></span></div>
            </div>
          </>
        ) : (
          <p className="unavailable-message">
            {geometry?.loading
              ? 'Waiting for the geometry provider response.'
              : response?.detail ||
                'No matching model-derived observation is available. Visit Site Analysis to request geometry.'}
          </p>
        )}

        <p className="tab-context-note">
          These are apparent directions at one observation time, not
          illumination-duration predictions, terrain-cleared visibility,
          or guaranteed communication windows.
        </p>
      </section>

      <section className="panel schedule-window-status">
        <h2>Mission schedule windows</h2>
        <div>
          <strong>Illumination windows</strong>
          <span className="data-unavailable">Unavailable · not calculated</span>
        </div>
        <div>
          <strong>Earth communication windows</strong>
          <span className="data-unavailable">Unavailable · not calculated</span>
        </div>
        <div>
          <strong>Terrain-aware visibility windows</strong>
          <span className="data-unavailable">Unavailable · no horizon analysis</span>
        </div>
      </section>
    </section>
  )
}
