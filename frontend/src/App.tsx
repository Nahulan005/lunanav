import { useState, type FormEvent } from 'react'
import { ArrowRight, ChevronDown, Clock3, Compass, FlaskConical, Globe2, Info, LoaderCircle, MapPin, Moon, Orbit, Radio, Rocket, ShieldCheck, Sun, Mountain } from 'lucide-react'
import { landingSites, demoAnalyses, initialRequest, type AnalysisRequest, type LandingSite } from './data/mockData'
import { analyzeMissionDemo } from './services/analysis'
import { MetricCard } from './components/MetricCard'
import { LunarMap } from './components/LunarMap'
import { MissionTimeline } from './components/MissionTimeline'
import { MissionHeader } from './components/MissionHeader'
import { SelectedSitePanel } from './components/SelectedSitePanel'
import { ScenarioComparison } from './components/ScenarioComparison'

function App() {
  const [request, setRequest] = useState<AnalysisRequest>(initialRequest)
  const [analyzedRequest, setAnalyzedRequest] = useState(initialRequest)
  const [analysis, setAnalysis] = useState(demoAnalyses.shackleton)
  const [loading, setLoading] = useState(false)
  const [selectedScenarioId, setSelectedScenarioId] = useState(initialRequest.siteId)
  const [message, setMessage] = useState('Sample analysis ready to explore.')
  const selected = landingSites.find((site) => site.id === request.siteId)!
  const analyzedSite = landingSites.find((site) => site.id === analyzedRequest.siteId)!
  const dirty = JSON.stringify(request) !== JSON.stringify(analyzedRequest)
  function selectSite(site: LandingSite) { setRequest((current) => ({ ...current, siteId: site.id, latitude: site.latitude, longitude: site.longitude })) }
  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setMessage('Loading illustrative mission estimates…')
    try {
      setAnalysis(await analyzeMissionDemo(request))
      setAnalyzedRequest({ ...request })
      setMessage('Demo analysis complete. No scientific calculations were performed.')
    } catch { setMessage('Unable to load demo estimates. Please try again.') }
    finally { setLoading(false) }
  }
  return <>
    <MissionHeader loading={loading} dirty={dirty} date={request.landingDate} />
    <main id="planner"><div className="page-heading"><div><div className="eyebrow"><span />SELENOGRAPHIC OPERATIONS / PLANNING WORKSPACE</div><h1>Lunar Landing Site Intelligence</h1><p>Evaluate the terrain. Find the window. Explore your next lunar mission.</p></div><div className="mission-label"><Moon size={19} /><div>LUNAR OPERATIONS<span>Mission planning workspace</span></div></div></div>
      <div className="demo-banner"><FlaskConical size={17} /><p><strong>ILLUSTRATIVE DEMO</strong> All values are demo estimates, not scientifically accurate predictions.</p><span>DEMO MODE</span></div>
      <div className="workspace-grid"><section className="panel setup-panel" id="site-analysis"><div className="section-heading"><h2><Compass size={18} />Landing site selection</h2><span className="step-label">01 / CONFIGURE</span></div><form onSubmit={handleAnalyze}><fieldset disabled={loading}><label htmlFor="site">Landing site</label><div className="select-wrap"><MapPin size={16} /><select id="site" value={request.siteId} onChange={(e) => selectSite(landingSites.find((s) => s.id === e.target.value)!)}>{landingSites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><ChevronDown size={14} /></div><div className="field-row"><div><label htmlFor="latitude">Latitude <span>°</span></label><input id="latitude" type="number" min="-90" max="90" step="any" required value={Number.isNaN(request.latitude) ? '' : request.latitude} onChange={(e) => setRequest({ ...request, siteId: 'custom', latitude: e.target.valueAsNumber })} /></div><div><label htmlFor="longitude">Longitude <span>°</span></label><input id="longitude" type="number" min="-180" max="180" step="any" required value={Number.isNaN(request.longitude) ? '' : request.longitude} onChange={(e) => setRequest({ ...request, siteId: 'custom', longitude: e.target.valueAsNumber })} /></div></div><label htmlFor="landing-date">Landing date <span>UTC</span></label><input id="landing-date" type="date" required value={request.landingDate} onChange={(e) => setRequest({ ...request, landingDate: e.target.value })} /><div className="duration-note"><Clock3 size={14} />Analysis window<span>7 Earth days</span></div><button className="analyze-button" type="submit">{loading ? <LoaderCircle className="spin" size={17} /> : <Rocket size={17} />}{loading ? 'Loading demo analysis…' : 'Analyze Mission'}{!loading && <ArrowRight size={17} />}</button></fieldset><p className="form-note"><Info size={13} />Runs locally using sample data</p></form></section>
        <LunarMap request={request} selected={selected} onSelect={selectSite} disabled={loading} />
        <SelectedSitePanel site={selected} request={request} loading={loading} dirty={dirty} /></div>
      <section className="results" aria-busy={loading} aria-label="Demo mission results"><div className="results-heading"><div><h2>Mission telemetry <span>/ {analyzedSite.name}</span></h2><p role="status">{dirty && !loading ? 'Configuration changed. Analyze Mission to refresh the demo results.' : message}</p></div><span className="results-date"><i className="legend-dot" />{analyzedRequest.landingDate} · 7-day window</span></div><div className={`metrics-grid ${loading ? 'loading-results' : ''}`}><MetricCard code="ILLUM / 01" label="Sunlight availability" value={analysis.sunlight} detail="Illustrative illumination coverage" icon={Sun} tone="amber" /><MetricCard code="COMM / 02" label="Earth visibility" value={analysis.visibility} detail="Illustrative communication coverage" icon={Radio} tone="cyan" /><MetricCard code="TERR / 03" label="Terrain obstruction" value={analysis.obstruction} detail="Sample obstruction · lower is better" icon={Mountain} tone="violet" /><MetricCard code="EVAL / 04" label="Mission feasibility" value={analysis.feasibility} detail="Illustrative score · not a safety rating" icon={ShieldCheck} tone={analysis.feasibility >= 75 ? "green" : "red"} /></div></section>
      <MissionTimeline date={analyzedRequest.landingDate} />
      <ScenarioComparison selectedId={selectedScenarioId} disabled={loading} onSelect={(site) => { setSelectedScenarioId(site.id); selectSite(site) }} />
      <footer><span><Orbit size={17} /><strong>LunaNav</strong><span className="footer-divider">/</span>A clearer path to the Moon.</span><span><Globe2 size={13} />Frontend preview <i />Mock data only</span></footer>
    </main>
  </>
}
export default App
