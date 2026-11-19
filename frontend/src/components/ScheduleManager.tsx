
import type { FormEvent } from 'react'
import { Clock3, MapPin } from 'lucide-react'
import type { AnalysisRequest } from '../data/mockData'
import { SunEarthGeometryPanel, type GeometryPanelState } from './SunEarthGeometryPanel'
import { GeometryTimeline } from './GeometryTimeline'

interface ScheduleManagerProps {
  request: AnalysisRequest
  siteName: string
  geometry: GeometryPanelState | null
  loading: boolean
  onGeometryState: (state: GeometryPanelState) => void
  onDateChange: (date: string) => void
  onAnalyze: (event: FormEvent<HTMLFormElement>) => void
}

export function ScheduleManager({
  request,
  siteName,
  geometry,
  loading,
  onDateChange,
  onGeometryState,
  onAnalyze,
}: ScheduleManagerProps) {
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

      <SunEarthGeometryPanel key={JSON.stringify(request)} request={request} onStateChange={onGeometryState} initialState={geometry} />
      <GeometryTimeline key={JSON.stringify(request)} geometry={geometry} />

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
