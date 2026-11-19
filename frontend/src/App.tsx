import { useState, useEffect, type FormEvent } from 'react'
import { ArrowRight, ChevronDown, Clock3, Compass, FlaskConical, Globe2, Info, LoaderCircle, MapPin, Moon, Orbit, Radio, Rocket, ShieldCheck, Sun, Mountain } from 'lucide-react'
import { landingSites, demoAnalyses, initialRequest, type AnalysisRequest, type LandingSite } from './data/mockData'
import { analyzeMission, checkBackendHealthResult, fetchTerrainSample, isWithinLolaCoverage, type TerrainSampleResult } from './services/analysis'
import { MetricCard } from './components/MetricCard'
import { LunarMap } from './components/LunarMap'
import { MissionHeader } from './components/MissionHeader'
import { ScenarioComparison } from './components/ScenarioComparison'
import { TerrainProvenancePanel } from './components/TerrainProvenancePanel'
import { SunEarthGeometryPanel, type GeometryPanelState } from './components/SunEarthGeometryPanel'
import { Moon3DView } from './features/moon3d/Moon3DView'
import { workspaceTabs, workspaceTabForHash } from './components/workspaceNavigation'
import { AnalysisDerivation } from './components/AnalysisDerivation'
import { MissionHome } from './components/MissionHome'
import './cosmic.css'
import './orbital.css'
import { ScheduleManager } from './components/ScheduleManager'
import { Site04TerrainExplorer } from './components/Site04TerrainExplorer'
import LandingVisualization from './features/landing/LandingVisualization'
import { AdaptiveSimulation } from './features/adaptive/AdaptiveSimulation'

function App() {
  const [workspaceHash, setWorkspaceHash] = useState(window.location.hash)
  const showMoon3D = workspaceHash === '#/landing-3d' || workspaceHash === '#landing-3d'
  const showLandingDemo = workspaceHash === '#/landing-demo'
  const showAdaptive = workspaceHash === '#/adaptive-simulation'
  const activeTab = workspaceTabForHash(workspaceHash)
  useEffect(() => {
    const navigate = () => setWorkspaceHash(window.location.hash)
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.getElementById(showAdaptive ? 'adaptive-simulation' : showLandingDemo ? 'landing-demo' : showMoon3D ? 'landing-3d' : 'workspace-content')?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [workspaceHash, showMoon3D, showLandingDemo, showAdaptive])
  const [request, setRequest] = useState<AnalysisRequest>(initialRequest)
  const [analyzedRequest, setAnalyzedRequest] = useState(initialRequest)
  const [analysis, setAnalysis] = useState(demoAnalyses.shackleton)
  const [loading, setLoading] = useState(false)
  const [selectedScenarioId, setSelectedScenarioId] = useState(initialRequest.siteId)
  const [message, setMessage] = useState('Sample analysis ready to explore.')
  const [backendConnected, setBackendConnected] = useState(false)
  const [connectionPending, setConnectionPending] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [terrainError, setTerrainError] = useState<string | null>(null)
  const [terrainResult, setTerrainResult] = useState<TerrainSampleResult | null>(null)
  const [terrainLoading, setTerrainLoading] = useState(false)
  const [geometryState, setGeometryState] = useState<GeometryPanelState | null>(null)

  const selected = landingSites.find((site) => site.id === request.siteId)!
  const analyzedSite = landingSites.find((site) => site.id === analyzedRequest.siteId)!
  const dirty = JSON.stringify(request) !== JSON.stringify(analyzedRequest)
  const isOutOfCoverage = !isWithinLolaCoverage(request.latitude, request.longitude)

  const terrainSample = !terrainLoading && terrainResult && !terrainResult.isFallback && !terrainResult.isOutOfCoverage
    && terrainResult.sample.mode === 'local-derived'
    && terrainResult.sample.coordinate_requested.latitude === request.latitude
    && terrainResult.sample.coordinate_requested.longitude === request.longitude
    && Number.isFinite(terrainResult.sample.elevation_value) ? terrainResult.sample : null
  const currentGeometry = geometryState?.requestKey === JSON.stringify(request) ? geometryState : null
  const geometryAvailable = currentGeometry?.response?.status === 'available' && currentGeometry.response.live_request_executed && currentGeometry.response.observation !== null
  const statusLabel = backendConnected ? 'Backend connected' : 'Backend unavailable / demo analysis'

  useEffect(() => {
    let active = true
    checkBackendHealthResult()
      .then(({ connected, error }) => {
        if (!active) return
        setBackendConnected(connected)
        setConnectionError(error)
        setConnectionPending(false)
        if (connected && isWithinLolaCoverage(initialRequest.latitude, initialRequest.longitude)) {
          fetchTerrainSample(initialRequest.latitude, initialRequest.longitude, message => { if (active) setTerrainError(message) })
            .then((res) => { if (active && res) setTerrainResult(res) })
            .catch(() => {})
        }
      })
      .catch(() => {
        if (active) setBackendConnected(false)
      })
    return () => { active = false }
  }, [])

  async function retryBackend() {
    setConnectionPending(true)
    setConnectionError(null)
    const result = await checkBackendHealthResult()
    setBackendConnected(result.connected)
    setConnectionError(result.error)
    setConnectionPending(false)
    if (result.connected && isWithinLolaCoverage(request.latitude, request.longitude)) {
      setTerrainLoading(true)
      setTerrainError(null)
      const sample = await fetchTerrainSample(request.latitude, request.longitude, setTerrainError)
      setTerrainResult(sample)
      setTerrainLoading(false)
    }
  }

  function selectSite(site: LandingSite) {
    setTerrainError(null)
    setRequest((current) => ({ ...current, siteId: site.id, latitude: site.latitude, longitude: site.longitude }))
    if (backendConnected && isWithinLolaCoverage(site.latitude, site.longitude)) {
      setTerrainLoading(true)
      fetchTerrainSample(site.latitude, site.longitude, setTerrainError)
        .then((res) => {
          setTerrainResult(res)
          setTerrainLoading(false)
        })
        .catch(() => {
          setTerrainLoading(false)
        })
    } else {
      setTerrainResult(null)
    }
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setMessage('Analyzing mission configuration…')

    try {
      const res = await analyzeMission(request)
      setAnalysis(res.analysis)
      setBackendConnected(res.isBackend)
      setAnalyzedRequest({ ...request })
      setMessage(
        res.isBackend
          ? isOutOfCoverage
            ? 'Backend analysis complete. Coordinates outside local LOLA coverage (demo fallback data used).'
            : 'Backend analysis complete. Illustrative estimates retrieved from backend.'
          : 'Demo analysis complete. No scientific calculations were performed.'
      )

      if (res.isBackend && !isOutOfCoverage) {
        setTerrainLoading(true)
        setTerrainError(null)
        const sample = await fetchTerrainSample(request.latitude, request.longitude, setTerrainError)
        setTerrainResult(sample)
        setTerrainLoading(false)
      } else {
        setTerrainResult(null)
      }
    } catch {
      setBackendConnected(false)
      setTerrainResult(null)
      setAnalyzedRequest({ ...request })
      setMessage('Demo analysis complete. No scientific calculations were performed.')
    } finally {
      setLoading(false)
    }
  }

  return <>
    <MissionHeader
      loading={loading}
      dirty={dirty}
      date={request.landingDate}
      backendConnected={backendConnected}
      isOutOfCoverage={isOutOfCoverage}
    />
    {!showMoon3D && !showLandingDemo && !showAdaptive && <main id="planner" className={`planning-workspace ${activeTab === 'overview' ? 'home-workspace' : ''}`}>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span />SELENOGRAPHIC OPERATIONS / PLANNING WORKSPACE</div>
          <h1>{workspaceTabs.find((tab) => tab.id === activeTab)?.label}</h1>
          <p>Lunar Landing Site Intelligence · mission-planning workspace</p>
        </div>
        <div className="mission-label">
          <Moon size={19} />
          <div>LUNAR OPERATIONS<span>Mission planning workspace</span></div>
        </div>
      </div>

      <div className="workspace-context-strip">
        <span><MapPin size={14} /><strong>{selected.name}</strong></span>
        <span>{Number.isFinite(request.latitude) ? `${request.latitude.toFixed(2)}°` : 'Unknown'} / {Number.isFinite(request.longitude) ? `${request.longitude.toFixed(2)}°` : 'Unknown'}</span>
        <span><Clock3 size={14} />{request.landingDate || 'Date not set'} UTC</span>
        <span role="status">{loading ? 'Analyzing…' : dirty ? 'Configuration changed' : 'Configuration ready'}</span>
        <span role="status">{connectionPending ? 'Checking backend…' : connectionError ?? statusLabel}</span>
        <button type="button" className="moon3d-mode-button" disabled={connectionPending} onClick={retryBackend}>{connectionPending ? 'Connecting…' : 'Retry backend connection'}</button>
      </div>
      <div id="workspace-content" tabIndex={-1} className="workspace-content" aria-label={workspaceTabs.find((tab) => tab.id === activeTab)?.label}>
      {activeTab === 'overview' && <section className="workspace-view" data-workspace-page="overview" aria-label="Overview">
        <MissionHome request={request} selected={selected} connected={backendConnected}
          terrain={terrainSample ? `${terrainSample.elevation_value} ${terrainSample.units} · local-derived` : terrainLoading ? 'Requesting sample' : isOutOfCoverage ? 'Unavailable · outside local coverage' : 'Unavailable · no matching response'}
          geometry={geometryAvailable ? 'Available · model-derived' : currentGeometry?.loading ? 'Requesting geometry' : 'Unavailable · inspect provider results'}
          onDate={landingDate => setRequest(current => ({ ...current, landingDate }))}
          onSelect={(point, id) => {
            const site = landingSites.find(item => item.id === id)
            if (site) selectSite(site)
            else { setRequest(current => ({ ...current, siteId: 'custom', latitude: point.latitude, longitude: point.longitude })); setTerrainResult(null) }
          }} />
      </section>}
      {activeTab === 'map' && <section className="workspace-view" data-workspace-page="map" aria-label="Lunar Map">
        <div className="workspace-section-label"><span>LUNAR MAP</span><p>Illustrative schematic · select a preset or enter coordinates</p></div>
        <div className="workspace-grid map-workspace">
        <section className="panel setup-panel" id="location-controls">
          <div className="section-heading">
            <h2><Compass size={18} />Landing site selection</h2>
            <span className="step-label">01 / CONFIGURE</span>
          </div>
          <form id="mission-configuration" onSubmit={handleAnalyze}>
            <fieldset disabled={loading}>
              <label htmlFor="site">Landing site</label>
              <div className="select-wrap">
                <MapPin size={16} />
                <select id="site" value={request.siteId} onChange={(e) => selectSite(landingSites.find((s) => s.id === e.target.value)!)}>
                  {landingSites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
              <div className="field-row">
                <div>
                  <label htmlFor="latitude">Latitude <span>°</span></label>
                  <input id="latitude" type="number" min="-90" max="90" step="any" required value={Number.isNaN(request.latitude) ? '' : request.latitude} onChange={(e) => { const latitude = e.target.valueAsNumber; setRequest(current => ({ ...current, siteId: 'custom', latitude })) }} />
                </div>
                <div>
                  <label htmlFor="longitude">Longitude <span>°</span></label>
                  <input id="longitude" type="number" min="-180" max="180" step="any" required value={Number.isNaN(request.longitude) ? '' : request.longitude} onChange={(e) => { const longitude = e.target.valueAsNumber; setRequest(current => ({ ...current, siteId: 'custom', longitude })) }} />
                </div>
              </div>
              <a className="schedule-shortcut" href="#/schedule">Landing date: {request.landingDate} UTC · Edit schedule</a>
              <div className="duration-note"><Clock3 size={14} />Analysis window<span>7 Earth days</span></div>
              <button className="analyze-button" type="submit">
                {loading ? <LoaderCircle className="spin" size={17} /> : <Rocket size={17} />}
                {loading ? 'Analyzing mission…' : 'Analyze Mission'}
                {!loading && <ArrowRight size={17} />}
              </button>
            </fieldset>
            <p className="form-note"><Info size={13} />{backendConnected && !isOutOfCoverage ? 'Connected to FastAPI backend' : 'Runs locally using sample data'}</p>
          </form>
        </section>

          <LunarMap request={request} selected={selected} onSelect={selectSite} disabled={loading} />
        </div>
      </section>}
      {activeTab === 'analysis' && <section className="workspace-view" data-workspace-page="analysis" aria-label="Site Analysis">
        <div className="workspace-section-label"><span>SITE ANALYSIS</span><p>Selected-location provider results → separate sources and limitations</p></div>
        <AnalysisDerivation request={request} siteName={selected.name} terrain={terrainSample}
          terrainLoading={terrainLoading} outsideCoverage={isOutOfCoverage} geometry={currentGeometry} />
        <SunEarthGeometryPanel key={JSON.stringify(request)} request={request} onStateChange={setGeometryState} initialState={geometryState} />
        <p className="tab-context-note">Terrain source, coverage, and checksum details are in <a href="#/coverage">Data &amp; Coverage</a>. Geometry is point-in-time context, not a schedule.</p>
        <section className="panel terrain-result" aria-label="Selected-location terrain result">
          <div className="section-heading"><h2><Mountain size={17} />LOLA point elevation</h2><span className="small-badge">{terrainSample ? 'LOCAL-DERIVED' : 'UNAVAILABLE'}</span></div>
          {terrainError && !terrainLoading && <p className="unavailable-message" role="status">{terrainError} Use Retry backend connection above to request this point again.</p>}
          {terrainSample ? <>
            <p className="terrain-elevation">{terrainSample.elevation_value} <small>{terrainSample.units}</small></p>
            <dl className="provider-facts"><div><dt>Source / product</dt><dd>{terrainSample.source_name} · {terrainSample.product_name} {terrainSample.product_version}</dd></div><div><dt>Sampled coordinates</dt><dd>{terrainSample.coordinate_used.latitude}° / {terrainSample.coordinate_used.longitude}°</dd></div><div><dt>Elevation reference</dt><dd>{terrainSample.reference_radius_m} m reference radius</dd></div><div><dt>Acquisition timestamp</dt><dd>Unavailable · not supplied by this endpoint</dd></div></dl>
            <p className="tab-context-note">Containing-cell elevation only. No interpolation or site-scale slope/horizon analysis; not scientifically validated for operations.</p>
          </> : <p className="unavailable-message">{terrainLoading ? 'Requesting a terrain sample.' : isOutOfCoverage ? 'Selected coordinates are outside local LOLA coverage.' : 'No matching local-derived terrain response is available.'} No substitute demo elevation is shown.</p>}
        </section>
      </section>}
      {activeTab === 'schedule' && (
        <ScheduleManager
          request={request}
          siteName={selected.name}
          geometry={currentGeometry}
          onGeometryState={setGeometryState}
          loading={loading}
          onDateChange={(landingDate) =>
            setRequest((current) => ({ ...current, landingDate }))
          }
          onAnalyze={handleAnalyze}
        />
      )}
      {activeTab === 'coverage' && <section className="workspace-view" data-workspace-page="coverage" aria-label="Data and Coverage">
        <div className="workspace-section-label"><span>DATA &amp; COVERAGE</span><p>Provenance, coverage boundaries, and unresolved data</p></div>
        <Site04TerrainExplorer point={request} onSelect={point => setRequest(current => ({ ...current, ...point, siteId: 'custom' }))} />
      {terrainSample && terrainResult ? (
        <TerrainProvenancePanel
          result={terrainResult}
          loading={terrainLoading}
          siteName={selected.name}
        />
      ) : (
        <section className="panel terrain-compact-notice" aria-label="Terrain coverage limitations">
          <div className="terrain-notice-content">
            <div className="terrain-notice-header">
              <Mountain size={15} />
              <span>LOLA TERRAIN COVERAGE &amp; LIMITATIONS</span>
              {isOutOfCoverage && (
                <span className="small-badge warning">Demo fallback — outside local LOLA coverage</span>
              )}
            </div>
            <ul className="terrain-limitations-list">
              <li>Real LOLA terrain available only for the current local coverage region.</li>
              <li>No provider elevation is shown when coverage or a matching response is unavailable.</li>
              <li>Single-cell elevation; no interpolation or RF link-budget calculation.</li>
            </ul>
          </div>
        </section>
      )}

        <section className="panel coverage-explanation">
          <h2>Source and interpretation guide</h2>
          <dl>
            <div><dt>LOLA terrain</dt><dd>Local point elevation only where a matching backend response is available. Missing coverage remains unavailable; demo fallbacks are not measured terrain.</dd></div>
            <div><dt>JPL Horizons geometry</dt><dd>Model-derived directions when available. See Site Analysis for source status and limitations; a direction is not terrain-cleared visibility or guaranteed communications.</dd></div>
            <div><dt>Demo comparisons and timeline</dt><dd>Fixed local fixtures; independent of NASA-derived provider values.</dd></div>
            <div><dt>Site04 observation coverage</dt><dd>A provisional 32×32 observation-count grid is available through the coverage API when its artifact passes integrity checks. Open 3D Landing to request the separate projected X/Y grid and inspect current status. No latitude/longitude overlay is verified.</dd></div>
          </dl>
          <p><a href="#/landing-3d">Open Site04 coverage in 3D Landing</a></p>
          <p>No validated spatial suitability grid or recommendation is available.</p>
        </section>
      </section>}
      {activeTab === 'compare' && <section className="workspace-view" data-workspace-page="compare" aria-label="Compare Scenarios">
        <div className="workspace-section-label"><span>COMPARE SCENARIOS</span><p>Illustrative fixtures only · not a spatial risk map or validated recommendation</p></div>
      <section className="results" aria-busy={loading} aria-label="Demo mission results">
        <div className="results-heading">
          <div>
            <h2>Last analyzed demo fixture <span>/ {analyzedSite.name}</span></h2>
            <p role="status">{dirty && !loading ? 'Configuration changed. Analyze Mission to refresh the results.' : message}</p>
          </div>
          <span className="results-date"><i className="legend-dot" />{analyzedRequest.landingDate} · 7-day window</span>
        </div>
        <div className={`metrics-grid ${loading ? 'loading-results' : ''}`}>
          <MetricCard code="ILLUM / 01" label="Sunlight availability" value={analysis.sunlight} detail="Illustrative illumination coverage" icon={Sun} tone="amber" />
          <MetricCard code="COMM / 02" label="Earth visibility" value={analysis.visibility} detail="Illustrative coverage · not a radio link proof" icon={Radio} tone="cyan" />
          <MetricCard code="TERR / 03" label="Terrain obstruction" value={analysis.obstruction} detail="Sample obstruction · lower is better" icon={Mountain} tone="violet" />
          <MetricCard code="EVAL / 04" label="Mission feasibility" value={analysis.feasibility} detail="Illustrative score · not a safety rating" icon={ShieldCheck} tone={analysis.feasibility >= 75 ? "green" : "red"} />
        </div>
      </section>

      <ScenarioComparison selectedId={selectedScenarioId} disabled={loading} onSelect={(site) => { setSelectedScenarioId(site.id); selectSite(site) }} />
      </section>}
      </div>
      <footer>
        <span><Orbit size={17} /><strong>LunaNav</strong><span className="footer-divider">/</span>A clearer path to the Moon.</span>
        <span><Globe2 size={13} />{statusLabel}</span>
      </footer>
    </main>}
    {showAdaptive && <AdaptiveSimulation siteName={selected.name} date={request.landingDate} />}
    {showLandingDemo && <main id="landing-demo" tabIndex={-1}>
      <LandingVisualization />
    </main>}
    {showMoon3D && <main id="landing-3d" tabIndex={-1}>
      <div className="page-heading">
        <div><h1>3D Landing</h1><p>Explore an illustrative lunar scene and demo landing-site comparisons.</p></div>
        <a href="#/overview">Return to dashboard</a>
      </div>
      <div className="demo-banner">
        <FlaskConical size={17} />
        <p><strong>ILLUSTRATIVE DEMO</strong> The Moon surface and coloured preset patches are illustrative fixtures. Real Site04 observation counts appear in a separate projected X/Y panel; provider point results have their own provenance. Overall risk remains Unknown.</p>
      </div>
      <Moon3DView initialSelectedId={request.siteId} initialLocation={{ latitude: request.latitude, longitude: request.longitude }} date={request.landingDate} />
    </main>}
  </>
}

export default App
