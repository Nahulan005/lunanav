import { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Compass,
  Radio,
  Sun,
  Globe,
  Activity,

  AlertTriangle,
  Rocket,

  Gauge,
  Navigation,

  Crosshair,
} from 'lucide-react';
import type { AnalysisRequest } from '../../data/mockData'
import { SunEarthGeometryPanel, type GeometryPanelState } from '../../components/SunEarthGeometryPanel'
import type { TerrainSample } from '../../services/analysis'
import { containsSite04Point, site04ToProjected } from '../../services/site04Terrain'
import { useSite04Footprint, useSite04Terrain } from '../../services/useSite04Terrain'
import { landingMockData } from './landingMockData';
import './LandingVisualization.css';

type DescentStatus = 'idle' | 'descending' | 'paused' | 'landed';

interface LandingProps {
  request: AnalysisRequest
  siteName: string
  pointTerrain: TerrainSample | null
  geometry: GeometryPanelState | null
  onGeometryState: (state: GeometryPanelState) => void
}

const missionDuration = 60
const playbackDuration = 30_000
const initialAltitude = landingMockData.descent.initialAltitude
const phases = landingMockData.telemetrySteps
const altitudeAt = (fraction: number) => initialAltitude * (1 - fraction) ** 2
const sceneHeight = (altitude: number) => 72 - altitude / initialAltitude * 60
const sceneX = (fraction: number) => 50 - 17 * (1 - Math.min(1, fraction / .82)) ** 2
const trajectory = Array.from({ length: 33 }, (_, index) => {
  const fraction = index / 32
  return `${index === 0 ? 'M' : 'L'} ${sceneX(fraction)} ${sceneHeight(altitudeAt(fraction))}`
}).join(' ')

export function LandingVisualization({ request, siteName, pointTerrain, geometry, onGeometryState }: LandingProps) {
  const [status, setStatus] = useState<DescentStatus>('idle')
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(0)
  const [sampleIndex, setSampleIndex] = useState(0)
  const samples = !geometry?.loading && geometry?.response?.status === 'available' && geometry.response.live_request_executed
    ? geometry.response.observations : []
  const sample = samples[Math.min(sampleIndex, samples.length - 1)]
  const bearing = (target: 'sun' | 'earth') => sample
    ? `${sample[target].azimuth_deg.toFixed(1)}° az / ${sample[target].elevation_deg.toFixed(1)}° el`
    : geometry?.loading ? 'Loading…' : 'Unavailable'

  const southPolar = request.latitude <= -89
  const footprint = useSite04Footprint(southPolar)
  const xy = southPolar ? site04ToProjected(request) : null
  const insideSite04 = Boolean(xy && footprint.data && containsSite04Point(footprint.data.projected_bounds, xy))
  const centre = useSite04Terrain(insideSite04, null)
  const centreCell = xy && centre.data?.cells.find(cell => containsSite04Point(cell.bounds, xy))
  const regional = useSite04Terrain(insideSite04 && !centre.loading && !centreCell, request)
  const terrainCell = centreCell || (xy && regional.data?.cells.find(cell => containsSite04Point(cell.bounds, xy)))
  const siteElevation = terrainCell?.elevation.status === 'available' ? terrainCell.elevation.value : null
  const terrainLoading = footprint.loading || centre.loading || regional.loading
  const coordinates = `${Math.abs(request.latitude).toFixed(2)}° ${request.latitude < 0 ? 'S' : 'N'}, ${Math.abs(request.longitude).toFixed(2)}° ${request.longitude < 0 ? 'W' : 'E'}`
  const sampleTime = sample ? `${new Date(sample.timestamp_utc).toISOString().slice(11, 16)} UTC` : 'Geometric direction'

  useEffect(() => {
    if (status !== 'descending') return
    let previous: number | undefined
    let frame: number
    const tick = (now: number) => {
      if (previous !== undefined) progressRef.current = Math.min(100, progressRef.current + Math.min(100, now - previous) / playbackDuration * 100)
      previous = now
      setProgress(progressRef.current)
      if (progressRef.current >= 100) setStatus('landed')
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [status])

  function seek(value: number) {
    progressRef.current = value
    setProgress(value)
    setStatus(value >= 100 ? 'landed' : value === 0 ? 'idle' : 'paused')
  }
  function handleStart() {
    if (status === 'landed') seek(0)
    setStatus('descending')
  }

  const fraction = progress / 100
  const altitude = Math.round(altitudeAt(fraction))
  const verticalSpeed = status === 'idle' ? 0 : -2 * initialAltitude * (1 - fraction) / missionDuration
  const elapsedTime = missionDuration * fraction
  const phase = phases.findLast(phase => progress >= phase.threshold) ?? phases[0]
  const currentPhase = status === 'idle' ? 'Approach ready' : phase.phase
  const heightFraction = altitude / initialAltitude
  const landerTop = sceneHeight(altitudeAt(fraction))
  const landerScale = 1 - heightFraction * 0.25

  return (
    <div className="luna-landing-container" role="region" aria-label="Lunar Landing Visualization">
      {/* MISSION CONTROL HEADER */}
      <header className="luna-header">
        <div className="luna-header-branding">
          <div className="luna-badge-icon">
            <Rocket size={18} className="icon-rocket" />
          </div>
          <div>
            <div className="luna-eyebrow">
              <span className="eyebrow-accent" />
              NASA SPACE APPS CHALLENGE / TERMINAL DESCENT SUITE
            </div>
            <h1 className="luna-title">{siteName} · Landing Demo</h1>
          </div>
        </div>

        <div className="luna-header-meta">
          <div className="luna-status-pill">
            <span
              className={`status-indicator-dot ${
                status === 'descending'
                  ? 'status-active'
                  : status === 'landed'
                  ? 'status-success'
                  : status === 'paused'
                  ? 'status-warning'
                  : 'status-idle'
              }`}
            />
            <span className="status-text">
              {status === 'descending'
                ? 'POWERED DESCENT IN PROGRESS'
                : status === 'landed'
                ? 'TOUCHDOWN CONFIRMED'
                : status === 'paused'
                ? 'DESCENT PAUSED'
                : 'READY FOR INITIATION'}
            </span>
          </div>

          <div className="mission-clock">
            <span className="clock-label">T+ DESCENT TIME</span>
            <span className="clock-value">{elapsedTime.toFixed(1)} s</span>
          </div>
        </div>
      </header>

      {/* PROMINENT DISCLAIMER BANNER */}
      <div className="luna-disclaimer-banner" role="alert">
        <AlertTriangle size={18} className="disclaimer-icon" />
        <div className="disclaimer-content">
          <strong>Scripted descent with live mission context.</strong>
          <span className="disclaimer-sub">
            Site coordinates, Horizons readings and available LOLA elevations are shown as context. The flight path, altitude above the demo surface, and terrain artwork are illustrative.
          </span>
        </div>
      </div>

      {/* MAIN VISUALIZATION VIEWPORT */}
      <div className="luna-stage-wrapper">
        <div className="luna-stage">
          {/* Deep Space Background with Stars */}
          <div className="stars-layer-deep" />
          <div className="stars-layer-medium" />
          <div className="stars-layer-bright" />
          <div className="space-nebula-glow" />

          {/* Celestial Direction Indicators */}
          <div className="celestial-hud">
            {/* Earth Indicator */}
            <div className="celestial-card earth-card">
              <div className="celestial-icon-wrap earth-orb">
                <Globe size={18} className="earth-svg" />
                <span className="celestial-ping earth-ping" />
              </div>
              <div className="celestial-data">
                <span className="celestial-title">EARTH · JPL HORIZONS</span>
                <span className="celestial-bearing">{bearing('earth')}</span>
                <span className="celestial-status">{sampleTime}</span>
              </div>
            </div>

            {/* Sun Indicator */}
            <div className="celestial-card sun-card">
              <div className="celestial-icon-wrap sun-orb">
                <Sun size={18} className="sun-svg" />
                <span className="celestial-ping sun-ping" />
              </div>
              <div className="celestial-data">
                <span className="celestial-title">SUN · JPL HORIZONS</span>
                <span className="celestial-bearing">{bearing('sun')}</span>
                <span className="celestial-status">{sampleTime}</span>
              </div>
            </div>
          </div>

          {/* Altitude Radar Guide Marks (HUD overlay) */}
          <div className="altitude-tape-overlay">
            {[1200, 800, 400, 100, 0].map(height => <div key={height} className="altitude-mark" style={{ top: `${sceneHeight(height)}%` }}>
              <span className="mark-line" /><span className="mark-label">{height} m</span>
            </div>)}
          </div>

          {/* Descent Trajectory Vector Guideline */}
          <div className="trajectory-line-wrapper">
            <svg className="trajectory-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d={trajectory} fill="none" stroke="rgba(90, 201, 237, 0.42)" strokeWidth="0.55" strokeDasharray="1.5 1.3" />
            </svg>
          </div>

          {/* LUNAR LANDER ILLUSTATIVE CRAFT */}
          <div
            className={`luna-lander-assembly ${status === 'descending' ? 'is-firing' : ''} ${
              status === 'landed' ? 'is-landed' : ''
            }`}
            style={{
              top: `${landerTop}%`,
              left: `${sceneX(fraction)}%`,
              transform: `translate(-50%, -50%) scale(${landerScale})`,
            }}
            aria-label={`Lunar Lander at ${altitude} meters altitude`}
          >
            {/* Thruster Flame (Active during descent) */}
            {status === 'descending' && (
              <div className="thruster-plume">
                <div className="thruster-core-flame" />
                <div className="thruster-outer-glow" />
                <div className="thruster-exhaust-particles" />
              </div>
            )}

            {/* Touchdown Dust Cloud (When very close to surface or landed) */}
            {(progress >= 95 || status === 'landed') && (
              <div className="touchdown-dust-effect">
                <div className="dust-puff puff-left" />
                <div className="dust-puff puff-right" />
              </div>
            )}

            {/* Illustrative Lander SVG Graphic */}
            <svg
              className="lander-svg"
              viewBox="0 0 120 120"
              width="100"
              height="100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Antenna and Sensors */}
              <line x1="60" y1="14" x2="60" y2="4" stroke="#89b4d8" strokeWidth="1.5" />
              <circle cx="60" cy="3" r="2.5" fill="#5ac9ed" />
              <line x1="48" y1="16" x2="40" y2="9" stroke="#89b4d8" strokeWidth="1.2" />
              <circle cx="39" cy="8" r="1.5" fill="#f0c16a" />

              {/* Ascent Stage (Crew Cabin) */}
              <polygon
                points="42,24 78,24 86,42 78,54 42,54 34,42"
                fill="#1b2a3a"
                stroke="#6488ab"
                strokeWidth="1.8"
              />
              {/* Crew Windows */}
              <polygon points="46,30 56,30 54,38 46,38" fill="#5ac9ed" fillOpacity="0.85" />
              <polygon points="64,30 74,30 74,38 66,38" fill="#5ac9ed" fillOpacity="0.85" />
              {/* Window Glare */}
              <line x1="48" y1="32" x2="52" y2="36" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />
              <line x1="66" y1="32" x2="70" y2="36" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />

              {/* RCS Thruster Quads */}
              <rect x="30" y="38" width="4" height="6" fill="#89a6c4" rx="1" />
              <rect x="86" y="38" width="4" height="6" fill="#89a6c4" rx="1" />

              {/* Descent Stage - Gold MLI Foil Texture */}
              <polygon
                points="36,54 84,54 90,74 30,74"
                fill="url(#goldFoilGradient)"
                stroke="#c99738"
                strokeWidth="1.5"
              />
              {/* Equipment Bay Details */}
              <rect x="44" y="58" width="14" height="12" fill="#2c2718" stroke="#a67c2e" strokeWidth="0.8" />
              <rect x="62" y="58" width="14" height="12" fill="#2c2718" stroke="#a67c2e" strokeWidth="0.8" />
              <circle cx="51" cy="64" r="2" fill="#70e3b0" />
              <circle cx="69" cy="64" r="2" fill="#5ac9ed" />

              {/* Main Descent Engine Bell */}
              <path d="M52 74 L48 84 L72 84 L68 74 Z" fill="#3a404a" stroke="#717b88" strokeWidth="1.2" />
              <ellipse cx="60" cy="84" rx="12" ry="2.5" fill="#20242b" stroke="#8c97a5" strokeWidth="1" />

              {/* Landing Struts & Footpads */}
              {/* Left Strut */}
              <line x1="38" y1="68" x2="16" y2="95" stroke="#9bb3ca" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="34" y1="56" x2="16" y2="95" stroke="#667e96" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="28" y1="80" x2="38" y2="74" stroke="#485c72" strokeWidth="1.2" />
              {/* Left Footpad */}
              <ellipse cx="14" cy="96" rx="8" ry="3" fill="#c4d5e7" stroke="#3d5166" strokeWidth="1.2" />

              {/* Right Strut */}
              <line x1="82" y1="68" x2="104" y2="95" stroke="#9bb3ca" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="86" y1="56" x2="104" y2="95" stroke="#667e96" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="92" y1="80" x2="82" y2="74" stroke="#485c72" strokeWidth="1.2" />
              {/* Right Footpad */}
              <ellipse cx="106" cy="96" rx="8" ry="3" fill="#c4d5e7" stroke="#3d5166" strokeWidth="1.2" />

              {/* Center Forward Footpads (Depth illusion) */}
              <line x1="48" y1="72" x2="42" y2="94" stroke="#7b93a8" strokeWidth="2" strokeLinecap="round" />
              <ellipse cx="42" cy="95" rx="6" ry="2.5" fill="#a8bdd3" stroke="#344657" strokeWidth="1" />

              <line x1="72" y1="72" x2="78" y2="94" stroke="#7b93a8" strokeWidth="2" strokeLinecap="round" />
              <ellipse cx="78" cy="95" rx="6" ry="2.5" fill="#a8bdd3" stroke="#344657" strokeWidth="1" />

              {/* Gradient Definitions */}
              <defs>
                <linearGradient id="goldFoilGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d4af37" />
                  <stop offset="35%" stopColor="#f3e5ab" />
                  <stop offset="70%" stopColor="#b38728" />
                  <stop offset="100%" stopColor="#fbf5b7" />
                </linearGradient>
              </defs>
            </svg>

            {/* Lander Live Telemetry Label */}
            <div className="lander-hud-label">
              <span className="lander-callsign">LUNANAV-1</span>
              <span className="lander-alt-tag">{altitude} m</span>
            </div>
          </div>

          {/* LUNAR SURFACE & TERRAIN RIDGES */}
          <div className="lunar-surface-zone">
            {/* Distant Mountain Ridges (Layer 1 - South Pole Massifs) */}
            <div className="lunar-ridge ridge-far" />

            {/* Mid-distance Shackleton Rim Ridges (Layer 2 - Illuminated Peak of Eternal Light) */}
            <div className="lunar-ridge ridge-mid" />

            {/* Foreground Terrain with Regolith Gradient & Craters */}
            <div className="lunar-ground">
              {/* Realistic-looking CSS Crater Formations */}
              <div className="craters-container">
                {landingMockData.terrain.craters.map((crater) => (
                  <div
                    key={crater.id}
                    className={`lunar-crater crater-${crater.depth}`}
                    style={{
                      left: `${crater.x}%`,
                      top: `${(crater.y ?? 0) - 70}%`,
                      width: `${crater.size}px`,
                      height: `${crater.size * 0.42}px`,
}}
                    title="Illustrative crater"
                  >
                    <div className="crater-rim" />
                    <div className="crater-floor" />
                    <div className="crater-sun-highlight" />
                  </div>
                ))}
              </div>

              {/* GLOWING LANDING TARGET MARKER */}
              <div className="landing-target-marker">
                <div className="target-beacon-beam" />
                <div className="target-rings-pulse" />
                <div className="target-ring ring-outer" />
                <div className="target-ring ring-inner" />
                <div className="target-crosshair">
                  <Crosshair size={26} className="target-crosshair-icon" />
                </div>
                <div className="target-callout">
                  <span className="target-title">{landingMockData.terrain.target.label}</span>
                  <span className="target-site-code">{siteName}</span>
                  <span className="target-coord-tag">{coordinates}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MISSION CONTROL TELEMETRY & CONTROLS DASHBOARD */}
      <div className="luna-dashboard-grid">
        {/* TELEMETRY READOUT PANEL */}
        <section className="luna-telemetry-panel" aria-label="Mission Telemetry">
          <div className="panel-title-bar">
            <div className="panel-title-text">
              <Compass size={16} className="panel-icon" />
              <span>DESCENT TELEMETRY STREAM</span>
            </div>
            <span className="source-tag">ILLUSTRATIVE MOCK TELEMETRY</span>
          </div>

          <div className="telemetry-metrics-grid">
            {/* Required Value: Selected Site */}
            <div className="telemetry-card highlight-card">
              <span className="metric-eyebrow">SELECTED SITE</span>
              <span className="metric-value site-name">{siteName}</span>
              <span className="metric-caption">{request.landingDate} UTC</span>
            </div>

            {/* Required Value: Coordinates */}
            <div className="telemetry-card">
              <span className="metric-eyebrow">SELECTED COORDINATES</span>
              <div className="coords-readout">
                <div>
                  <span className="coord-axis">Latitude:</span>
                  <span className="coord-val">{request.latitude}°</span>
                </div>
                <div>
                  <span className="coord-axis">Longitude:</span>
                  <span className="coord-val">{request.longitude}°</span>
                </div>
              </div>
              <span className="metric-caption">Selenographic System</span>
            </div>

            {/* Required Value: Status */}
            <div className="telemetry-card">
              <span className="metric-eyebrow">MISSION STATUS</span>
              <span className="metric-value status-val">{landingMockData.status}</span>
              <span className="metric-caption">Execution state: {status.toUpperCase()}</span>
            </div>

            {/* Required Value: Terrain Source */}
            <div className="telemetry-card">
              <span className="metric-eyebrow">LOLA ELEVATION CONTEXT</span>
              <span className="metric-value terrain-val">{siteElevation != null ? `${siteElevation.toFixed(1)} m` : pointTerrain ? `${pointTerrain.elevation_value.toFixed(1)} m` : terrainLoading ? 'Checking coverage…' : 'Unavailable'}</span>
              <span className="metric-caption">{siteElevation != null ? 'Site04 · provisional surface product' : pointTerrain ? 'LDEM_4 · coarse containing-cell sample' : 'No matching point sample returned.'}</span>
            </div>
          </div>

          {/* DYNAMIC ALTITUDE & DESCENT METRICS */}
          <div className="dynamic-telemetry-row">
            {/* Altitude Card */}
            <div className="flight-dynamic-card">
              <div className="flight-card-head">
                <Gauge size={15} />
                <span>RADAR ALTITUDE (MOCK)</span>
              </div>
              <div className="flight-card-body">
                <span className="altitude-digit">{altitude}</span>
                <span className="altitude-unit">METERS</span>
              </div>
              <div className="altitude-bar-container">
                <div
                  className="altitude-bar-fill"
                  style={{ width: `${(altitude / landingMockData.descent.initialAltitude) * 100}%` }}
                />
              </div>
            </div>

            {/* Vertical Descent Speed Card */}
            <div className="flight-dynamic-card">
              <div className="flight-card-head">
                <Activity size={15} />
                <span>VERTICAL VELOCITY (MOCK)</span>
              </div>
              <div className="flight-card-body">
                <span className="speed-digit">{verticalSpeed.toFixed(1)}</span>
                <span className="altitude-unit">M / SEC</span>
              </div>
              <span className="speed-caption">
                {status === 'landed'
                  ? 'Surface touchdown - Engine cutoff'
                  : status === 'descending'
                  ? 'Terminal deceleration burn'
                  : 'Holding trajectory'}
              </span>
            </div>

            {/* Descent Progress & Phase Card */}
            <div className="flight-dynamic-card">
              <div className="flight-card-head">
                <Navigation size={15} />
                <span>DESCENT COMPLETION</span>
              </div>
              <div className="flight-card-body">
                <span className="progress-digit">{progress.toFixed(0)}%</span>
                <span className="phase-badge">{currentPhase}</span>
              </div>
              {/* Progress Bar Updating During Descent */}
              <div className="progress-bar-container" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </section>

        {/* MISSION CONTROL COMMANDS PANEL */}
        <section className="luna-controls-panel" aria-label="Descent Controls">
          <div className="panel-title-bar">
            <div className="panel-title-text">
              <Radio size={16} className="panel-icon" />
              <span>COMMAND TERMINAL</span>
            </div>
            <span className="control-mode-tag">MANUAL OVERRIDE</span>
          </div>

          <div className="controls-button-group">
            {/* Start Landing Button */}
            <button
              type="button"
              className={`control-btn btn-start ${status === 'descending' ? 'btn-active' : ''}`}
              onClick={handleStart}
              disabled={status === 'descending'}
              aria-label="Start Landing descent sequence"
            >
              <Play size={18} />
              <span>{status === 'paused' ? 'Resume Descent' : status === 'landed' ? 'Restart Landing' : 'Start Landing'}</span>
            </button>

            {/* Pause Button */}
            <button
              type="button"
              className="control-btn btn-pause"
              onClick={() => setStatus('paused')}
              disabled={status !== 'descending'}
              aria-label="Pause descent sequence"
            >
              <Pause size={18} />
              <span>Pause</span>
            </button>

            {/* Reset Button */}
            <button
              type="button"
              className="control-btn btn-reset"
              onClick={() => seek(0)}
              aria-label="Reset landing visualization to initial altitude"
            >
              <RotateCcw size={18} />
              <span>Reset</span>
            </button>
          </div>

          <label className="landing-scrub">Replay position · {elapsedTime.toFixed(1)} s
            <input type="range" min={0} max={100} step={0.1} value={progress} onChange={event => seek(event.target.valueAsNumber)} />
          </label>
          <p className="landing-context-note">30 seconds of playback represents a 60-second demo descent.</p>
        </section>
      </div>
      <section className="panel mission-schedule-tables landing-phase-table">
        <header><div><h2>Descent phase schedule</h2><p>Simulated mission elapsed time</p></div><a href="#/schedule">Open UTC geometry schedule</a></header>
        <div className="mission-table-scroll" tabIndex={0} aria-label="Descent phase schedule">
          <table><caption>Demo phase starts</caption><thead><tr><th scope="col">Phase</th><th scope="col">T+</th><th scope="col">Altitude</th><th scope="col">Replay</th></tr></thead>
            <tbody>{phases.map(row => <tr key={row.threshold} aria-current={row === phase && status !== 'idle' ? 'step' : undefined}>
              <th scope="row">{row.phase}</th><td>{(row.threshold / 100 * missionDuration).toFixed(1)} s</td><td>{altitudeAt(row.threshold / 100).toFixed(1)} m</td>
              <td><button type="button" className="moon3d-mode-button" onClick={() => seek(row.threshold)}>Jump</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="landing-provider-context">
        <p className="landing-context-note">The HUD follows the selected UTC sample. Readings below show the first returned observation.</p>
        <label>HUD geometry sample
          <select disabled={!samples.length} value={samples.length ? Math.min(sampleIndex, samples.length - 1) : 0} onChange={event => setSampleIndex(Number(event.target.value))}>
            {samples.length ? samples.map((reading, index) => <option key={reading.timestamp_utc} value={index}>{new Date(reading.timestamp_utc).toISOString().slice(0, 16).replace('T', ' ')} UTC</option>) : <option value={0}>No returned geometry</option>}
          </select>
        </label>
        <SunEarthGeometryPanel request={request} onStateChange={onGeometryState} initialState={geometry} />
      </section>
    </div>
  );
};

export default LandingVisualization;
