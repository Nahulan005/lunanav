
import { Clock3, MapPin } from 'lucide-react'
import type { AnalysisRequest } from '../data/mockData'
import { SunEarthGeometryPanel, type GeometryPanelState } from './SunEarthGeometryPanel'
import { GeometryTimeline } from './GeometryTimeline'

interface ScheduleManagerProps {
  request: AnalysisRequest
  siteName: string
  geometry: GeometryPanelState | null
  onGeometryState: (state: GeometryPanelState) => void
  onDateChange: (date: string) => void
}

export function ScheduleManager({
  request,
  siteName,
  geometry,
  onDateChange,
  onGeometryState,
}: ScheduleManagerProps) {
  return (
    <section className="workspace-view" data-workspace-page="schedule" aria-label="Mission Schedule">
      <div className="workspace-section-label">
        <span>MISSION SCHEDULE</span>
        <p>Landing configuration · geometry context · schedule availability</p>
      </div>

      <section className="panel schedule-controls">
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
          required
          value={request.landingDate}
          onChange={(event) => onDateChange(event.target.value)}
        />

        <p className="tab-context-note">Changing the date requests new geometry samples for this site.</p>
      </section>

      <SunEarthGeometryPanel key={JSON.stringify(request)} request={request} onStateChange={onGeometryState} initialState={geometry} />
      <GeometryTimeline key={JSON.stringify(request)} geometry={geometry} />

      <section className="panel schedule-window-status">
        <h2>What’s needed to calculate windows</h2>
        <div><strong>Sunlight at the site</strong><span>Terrain horizon along the Sun’s path.</span></div>
        <div><strong>Direct Earth visibility</strong><span>Terrain horizon along Earth’s path.</span></div>
        <div><strong>Radio communications</strong><span>Earth visibility, antenna geometry and link requirements.</span></div>
      </section>
    </section>
  )
}
