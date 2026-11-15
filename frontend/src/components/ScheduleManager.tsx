
import { CalendarDays, Clock3, Globe2, Sun } from 'lucide-react'
import type { AnalysisRequest } from '../data/mockData'
import type { GeometryPanelState } from './SunEarthGeometryPanel'

interface ScheduleManagerProps {
  request: AnalysisRequest
  siteName: string
  geometryState: GeometryPanelState | null
}

export function ScheduleManager({
  request,
  siteName,
  geometryState,
}: ScheduleManagerProps) {
  const isCurrentRequest =
    geometryState?.requestKey === JSON.stringify(request)

  const response = isCurrentRequest ? geometryState?.response : null

  const observation =
    response?.status === 'available' &&
    response.live_request_executed
      ? response.observation
      : null

  const formatAngle = (value: number | undefined) =>
    value === undefined ? 'Unavailable' : `${value.toFixed(2)}°`

  return (
    <section className="panel schedule-manager" id="schedule-manager">
      <div className="section-heading">
        <h2>
          <CalendarDays size={18} />
          Schedule Manager
        </h2>
        <span className="step-label">MISSION PLANNING PREVIEW</span>
      </div>

      <div className="schedule-selection">
        <div>
          <span>Selected landing site</span>
          <strong>{siteName}</strong>
        </div>
        <div>
          <span>Landing date (UTC)</span>
          <strong>{request.landingDate || 'Unavailable'}</strong>
        </div>
        <div>
          <span>Landing time (UTC)</span>
          <strong>Not provided by current API</strong>
        </div>
      </div>

      <div className="schedule-subheading">
        <Sun size={16} />
        <h3>Sun &amp; Earth model context</h3>
        <span>Model-derived context</span>
      </div>

      <div className="schedule-readings">
        <div>
          <Sun size={15} />
          <span>Sun azimuth</span>
          <strong>{formatAngle(observation?.sun.azimuth_deg)}</strong>
        </div>
        <div>
          <Sun size={15} />
          <span>Sun elevation</span>
          <strong>{formatAngle(observation?.sun.elevation_deg)}</strong>
        </div>
        <div>
          <Globe2 size={15} />
          <span>Earth azimuth</span>
          <strong>{formatAngle(observation?.earth.azimuth_deg)}</strong>
        </div>
        <div>
          <Globe2 size={15} />
          <span>Earth elevation</span>
          <strong>{formatAngle(observation?.earth.elevation_deg)}</strong>
        </div>
      </div>

      <p className="schedule-epoch">
        <Clock3 size={13} />
        Observation time (UTC):{' '}
        {observation
          ? new Date(observation.timestamp_utc).toISOString()
          : 'Unavailable'}
      </p>

      <div className="schedule-window">
        <h3>Mission schedule windows</h3>
        <p>
          Validated sunlight and Earth-communication windows are
          unavailable from the current API response.
        </p>
        <div className="schedule-placeholder">
          <span>Illumination window</span>
          <strong>Unavailable — not calculated</strong>
        </div>
        <div className="schedule-placeholder">
          <span>Communication window</span>
          <strong>Unavailable — not calculated</strong>
        </div>
      </div>

      <p className="schedule-warning">
        Not a validated operational schedule. Terrain-aware illumination,
        RF link performance, and landing safety are not assessed.
      </p>
    </section>
  )
}
