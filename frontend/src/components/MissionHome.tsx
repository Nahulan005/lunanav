import { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarDays, Crosshair, Layers, PanelRightClose, PanelRightOpen, Radio, Orbit, Eye, EyeOff, Navigation } from 'lucide-react'
import { Moon3DView } from '../features/moon3d/Moon3DView'
import { landingSites, type AnalysisRequest, type LandingSite } from '../data/mockData'
import type { SurfaceLocation } from '../features/moon3d/ScreeningDetails'
import { OrbitalBackdrop } from './OrbitalBackdrop'

interface Props {
  request: AnalysisRequest
  selected: LandingSite
  onSelect: (location: SurfaceLocation, presetId?: string) => void
  onDate: (date: string) => void
  terrain: string
  geometry: string
  connected: boolean
}

export function MissionHome({ request, selected, onSelect, onDate, terrain, geometry, connected }: Props) {
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [hudVisible, setHudVisible] = useState(true)
  useEffect(() => {
    document.documentElement.classList.add('cockpit-home')
    return () => { document.documentElement.classList.remove('cockpit-home', 'cockpit-hud-hidden') }
  }, [])
  useEffect(() => { document.documentElement.classList.toggle('cockpit-hud-hidden', !hudVisible) }, [hudVisible])
  return <section className={`mission-home orbital-home ${consoleOpen ? 'console-open' : ''}`} aria-label="Moon-first mission workspace">
    <button className="hud-visibility-toggle" aria-pressed={hudVisible} onClick={() => setHudVisible(value => !value)}>{hudVisible ? <EyeOff size={16} /> : <Eye size={16} />}{hudVisible ? 'Hide HUD' : 'Show HUD'}</button>
    <div className="home-intro"><div><span className="eyebrow">LUNANAV / ORBITAL OBSERVATION DECK</span><h2>The Moon.<br /><em>Within reach.</em></h2><p>Explore the surface from an illustrative spacecraft perspective.</p></div>
      <button className="console-toggle" onClick={() => setConsoleOpen(!consoleOpen)} aria-expanded={consoleOpen} aria-controls="home-console">{consoleOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />} Mission console</button></div>
    <div className="home-scene-grid">
      <div className="cosmic-scene">
        <OrbitalBackdrop />
        <div className="cockpit-window" aria-hidden="true"><i /><i /><span>LN / OBSERVATION WINDOW</span></div>
        <div className="orbital-attitude" aria-hidden="true"><Crosshair size={30} /><span>OPTICAL AXIS</span><i /><span>SCENE / DEMO</span></div>
        <div className="scene-caption"><Orbit size={13} /> ORBITAL PERSPECTIVE <span>Illustrative scene</span></div>
        <Moon3DView initialSelectedId={request.siteId} initialLocation={request} date={request.landingDate} compact onLocationSelect={(point, id) => { onSelect(point, id); setConsoleOpen(true) }} />
        <div className="home-scene-foot"><span><Crosshair size={13} /> Select a node or any surface point</span><a href="#/landing-3d">Open full explorer <ArrowUpRight size={14} /></a></div>
      </div>
      {consoleOpen && <aside id="home-console" className="home-console">
        <div className="console-kicker"><span className="status-light" /> MISSION CONTEXT <span>01</span></div>
        <div className="console-target"><span className="eyebrow">SELECTED LOCATION</span><h3>{selected.name}</h3><p>{request.latitude.toFixed(4)}° / {request.longitude.toFixed(4)}° east</p><span className="small-badge">Screening · not evaluated</span></div>
        <div className="console-site-list" aria-label="Preset locations">{landingSites.filter(s => s.id !== 'custom').map(site => <button key={site.id} aria-pressed={request.siteId === site.id} onClick={() => onSelect(site, site.id)}><Crosshair size={13} />{site.name}<ArrowUpRight size={12} /></button>)}</div>
        <h4><Radio size={14} /> Source availability</h4>
        <dl className="console-providers"><div><dt>LOLA elevation</dt><dd>{terrain}</dd></div><div><dt>Horizons directions</dt><dd>{geometry}</dd></div><div><dt>Site04 observation coverage</dt><dd><a href="#/landing-3d">Open separate projected X/Y grid</a> · availability checked in explorer</dd></div></dl>
        <a className="console-primary" href="#/analysis">Inspect provider results <ArrowUpRight size={15} /></a>
        <p className="console-footnote">{connected ? 'Backend connected. Analysis estimates remain demo.' : 'Backend unavailable / demo analysis.'} No evaluated suitability score or recommendation.</p>
      </aside>}
    </div>
    <div className="home-epoch"><CalendarDays size={18} /><label htmlFor="home-date">Planning epoch<span>UTC date · scene lighting is decorative</span></label><input id="home-date" type="date" required value={request.landingDate} onChange={event => onDate(event.target.value)} /><a href="#/schedule">Open schedule <ArrowUpRight size={15} /></a><span><Layers size={13} /> No forecast inferred</span></div>
    <div className="home-simulation-links"><a href="#/landing-demo"><Orbit size={16} /> Landing Demo <small>MOCK DESCENT</small></a><a href="#/adaptive-simulation"><Navigation size={16} /> Adaptive Simulation <small>SCRIPTED COURSE CHANGE</small></a></div>
    <span className="immersive-scene-label">Illustrative orbital scene · decorative lighting and celestial positions</span>
    <a className="space-art-credit" href="https://svs.gsfc.nasa.gov/30613/" target="_blank" rel="noreferrer">Earth photograph: NASA / JSC · decorative</a>
  </section>
}
