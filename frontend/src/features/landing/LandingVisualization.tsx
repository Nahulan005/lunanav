import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Compass,
  Radio,
  Sun,
  Globe,
  Activity,

  Layers,
  AlertTriangle,
  Rocket,

  Gauge,
  Navigation,

  Crosshair,
} from 'lucide-react';
import { landingMockData } from './landingMockData';
import './LandingVisualization.css';

type DescentStatus = 'idle' | 'descending' | 'paused' | 'landed';

export const LandingVisualization: React.FC = () => {
  const [status, setStatus] = useState<DescentStatus>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [altitude, setAltitude] = useState<number>(landingMockData.descent.initialAltitude);
  const [verticalSpeed, setVerticalSpeed] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [currentPhase, setCurrentPhase] = useState<string>('Approach Orbit Ready');

  // Animation frame and timing refs
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const progressRef = useRef<number>(0);
  const statusRef = useRef<DescentStatus>('idle');

  // Keep refs synchronized with state to prevent stale closures
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Determine current telemetry descent phase descriptor
  const getPhaseData = useCallback((currentProg: number) => {
    const phases = landingMockData.telemetrySteps;
    for (let i = phases.length - 1; i >= 0; i--) {
      if (currentProg >= phases[i].threshold) {
        return phases[i];
      }
    }
    return phases[0];
  }, []);

  // Main animation step function
  const step = useCallback(
    function animateStep(timestamp: number) {
      if (statusRef.current !== 'descending') {
        animationFrameRef.current = null;
        lastTimeRef.current = null;
        return;
      }

      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }

      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const duration = landingMockData.descent.descentDuration;
      const progressDelta = (deltaTime / duration) * 100;
      const nextProgress = Math.min(100, progressRef.current + progressDelta);

      progressRef.current = nextProgress;
      setProgress(nextProgress);

      // Illustrative altitude calculation
      const initialAlt = landingMockData.descent.initialAltitude;
      const nextAltitude = Math.max(0, Math.round(initialAlt * (1 - nextProgress / 100)));
      setAltitude(nextAltitude);

      // Elapsed time
      setElapsedTime((prev) => +(prev + deltaTime / 1000).toFixed(1));

      // Illustrative vertical speed calculation based on descent progress
      if (nextProgress >= 100) {
        setVerticalSpeed(0);
        setCurrentPhase('Touchdown Confirmed');
        setStatus('landed');
        animationFrameRef.current = null;
        lastTimeRef.current = null;
        return;
      } else {
        const phaseInfo = getPhaseData(nextProgress);
        setCurrentPhase(phaseInfo.phase);

        // Illustrative velocity profile: deceleration curve
        let mockSpeed: number;
        if (nextProgress < 30) {
          mockSpeed = -35.0 + (nextProgress / 30) * 10;
        } else if (nextProgress < 70) {
          mockSpeed = -25.0 + ((nextProgress - 30) / 40) * 12;
        } else if (nextProgress < 90) {
          mockSpeed = -13.0 + ((nextProgress - 70) / 20) * 8;
        } else {
          mockSpeed = -5.0 + ((nextProgress - 90) / 10) * 3.8;
        }
        setVerticalSpeed(parseFloat(mockSpeed.toFixed(1)));
      }

      // Schedule next frame
      animationFrameRef.current = requestAnimationFrame(animateStep);
    },
    [getPhaseData]
  );

  // Start / Resume descent handler
  const handleStart = () => {
    // If completed or already landing, handle accordingly
    if (status === 'landed') {
      // Auto reset before re-running
      handleReset();
      setTimeout(() => {
        setStatus('descending');
      }, 50);
      return;
    }

    if (status === 'descending') return; // Prevent multiple loops

    // Clean up any existing frame to prevent duplicate loops
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    lastTimeRef.current = null;
    setStatus('descending');
  };

  // Pause descent handler
  const handlePause = () => {
    if (status !== 'descending') return;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    lastTimeRef.current = null;
    setStatus('paused');
  };

  // Reset descent handler
  const handleReset = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    lastTimeRef.current = null;
    progressRef.current = 0;
    setProgress(0);
    setAltitude(landingMockData.descent.initialAltitude);
    setVerticalSpeed(0);
    setElapsedTime(0);
    setCurrentPhase('Approach Orbit Ready');
    setStatus('idle');
  };

  // Trigger animation loop when status becomes descending
  useEffect(() => {
    if (status === 'descending') {
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(step);
      }
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [status, step]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  // Compute lander vertical position style percentage
  // Progress 0% -> top: 12% (high altitude), Progress 100% -> top: 72% (touchdown on landing target)
  const landerTop = 12 + (progress / 100) * 60;
  // Subtle scaling effect to simulate approaching perspective (0.75x at high alt to 1.0x at surface)
  const landerScale = 0.75 + (progress / 100) * 0.25;

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
            <h1 className="luna-title">Shackleton Rim Landing Visualization</h1>
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
            <span className="clock-value">00:{elapsedTime.toFixed(0).padStart(2, '0')}s</span>
          </div>
        </div>
      </header>

      {/* PROMINENT DISCLAIMER BANNER */}
      <div className="luna-disclaimer-banner" role="alert">
        <AlertTriangle size={18} className="disclaimer-icon" />
        <div className="disclaimer-content">
          <strong>Illustrative visualization. This is not a flight-dynamics simulation.</strong>
          <span className="disclaimer-sub">
            All telemetry, coordinates, terrain, and Sun/Earth indicators are illustrative mock values.
            No real communications availability, guidance, or landing safety is assessed.
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
            <div className="celestial-card earth-card" title={landingMockData.environment.earthStatus}>
              <div className="celestial-icon-wrap earth-orb">
                <Globe size={18} className="earth-svg" />
                <span className="celestial-ping earth-ping" />
              </div>
              <div className="celestial-data">
                <span className="celestial-title">EARTH DIRECTION (MOCK)</span>
                <span className="celestial-bearing">{landingMockData.environment.earthBearing}</span>
                <span className="celestial-status">MOCK INDICATOR — RF LINK NOT ASSESSED</span>
              </div>
            </div>

            {/* Sun Indicator */}
            <div className="celestial-card sun-card" title={landingMockData.environment.sunStatus}>
              <div className="celestial-icon-wrap sun-orb">
                <Sun size={18} className="sun-svg" />
                <span className="celestial-ping sun-ping" />
              </div>
              <div className="celestial-data">
                <span className="celestial-title">SUN DIRECTION (MOCK)</span>
                <span className="celestial-bearing">{landingMockData.environment.sunBearing}</span>
                <span className="celestial-status">GRAZING POLAR ILLUMINATION</span>
              </div>
            </div>
          </div>

          {/* Altitude Radar Guide Marks (HUD overlay) */}
          <div className="altitude-tape-overlay">
            <div className="altitude-mark mark-1200">
              <span className="mark-line" />
              <span className="mark-label">1200 m (High Gate)</span>
            </div>
            <div className="altitude-mark mark-800">
              <span className="mark-line" />
              <span className="mark-label">800 m (Pitch-Up)</span>
            </div>
            <div className="altitude-mark mark-400">
              <span className="mark-line" />
              <span className="mark-label">400 m (Terminal Gate)</span>
            </div>
            <div className="altitude-mark mark-100">
              <span className="mark-line" />
              <span className="mark-label">100 m (Vertical Descent)</span>
            </div>
            <div className="altitude-mark mark-0">
              <span className="mark-line" />
              <span className="mark-label">0 m (Touchdown)</span>
            </div>
          </div>

          {/* Descent Trajectory Vector Guideline */}
          <div className="trajectory-line-wrapper">
            <svg className="trajectory-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line
                x1="50"
                y1="12"
                x2="50"
                y2="75"
                stroke="rgba(90, 201, 237, 0.28)"
                strokeWidth="0.8"
                strokeDasharray="2, 2"
              />
            </svg>
          </div>

          {/* LUNAR LANDER ILLUSTATIVE CRAFT */}
          <div
            className={`luna-lander-assembly ${status === 'descending' ? 'is-firing' : ''} ${
              status === 'landed' ? 'is-landed' : ''
            }`}
            style={{
              top: `${landerTop}%`,
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
                    title={`${crater.name} (Illustrative)`}
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
                  <span className="target-site-code">{landingMockData.terrain.target.subLabel}</span>
                  <span className="target-coord-tag">{landingMockData.terrain.target.coordinatesText}</span>
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
              <span className="metric-value site-name">{landingMockData.siteName}</span>
              <span className="metric-caption">Lunar South Pole Peak</span>
            </div>

            {/* Required Value: Coordinates */}
            <div className="telemetry-card">
              <span className="metric-eyebrow">TARGET COORDINATES (MOCK)</span>
              <div className="coords-readout">
                <div>
                  <span className="coord-axis">Latitude:</span>
                  <span className="coord-val">{landingMockData.coordinates.latitude}°</span>
                </div>
                <div>
                  <span className="coord-axis">Longitude:</span>
                  <span className="coord-val">{landingMockData.coordinates.longitude}°</span>
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
              <span className="metric-eyebrow">TERRAIN SOURCE</span>
              <span className="metric-value terrain-val">{landingMockData.terrainSource}</span>
              <span className="metric-caption">Illustrative CSS terrain — no LOLA data used here</span>
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
              onClick={handlePause}
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
              onClick={handleReset}
              aria-label="Reset landing visualization to initial altitude"
            >
              <RotateCcw size={18} />
              <span>Reset</span>
            </button>
          </div>

          <div className="control-briefing">
            <div className="briefing-item">
              <Layers size={14} className="brief-icon" />
              <p>
                <strong>Start initiates</strong> smooth illustrative descent sequence with dynamic altitude tracking.
              </p>
            </div>
            <div className="briefing-item">
              <Pause size={14} className="brief-icon" />
              <p>
                <strong>Pause freezes</strong> current descent progress, altitude, and trajectory in place.
              </p>
            </div>
            <div className="briefing-item">
              <RotateCcw size={14} className="brief-icon" />
              <p>
                <strong>Reset returns</strong> lander to initial {landingMockData.descent.initialAltitude} m altitude.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LandingVisualization;

