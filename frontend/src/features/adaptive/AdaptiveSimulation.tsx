import { useEffect, useReducer, useRef, type CSSProperties } from 'react'
import { Crosshair, Layers, Pause, Play, RotateCcw, Navigation, AlertTriangle } from 'lucide-react'
import { demoDestinations, initialScenario, scenarioReducer } from './scenario'
import './adaptive.css'

export function AdaptiveSimulation({ siteName, date }: { siteName: string; date: string }) {
  const [state, dispatch] = useReducer(scenarioReducer, initialScenario)
  const dialog = useRef<HTMLDialogElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const target = demoDestinations.find(d => d.id === state.destination)!
  const proposal = demoDestinations.find(d => d.id === state.proposal)
  const moving = ['approach', 'divert', 'descent'].includes(state.phase)
  const finished = state.phase === 'success' || state.phase === 'failure'
  useEffect(() => {
    if (!moving || state.paused) return
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      // Avoid skipping the whole flight after a suspended/background tab resumes.
      dispatch({ type: 'tick', delta: Math.min(200, now - previous) })
      previous = now
    }, 50)
    return () => clearInterval(timer)
  }, [moving, state.paused, state.phase])
  useEffect(() => {
    if (proposal && dialog.current && !dialog.current.open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.current.showModal()
    } else if (!proposal && dialog.current?.open) {
      dialog.current.close()
      returnFocus.current?.focus()
    }
  }, [proposal])
  const approach = state.phase === 'ready' ? 0 : state.phase === 'approach' ? state.elapsed / 2000 : 1
  const descent = state.phase === 'descent' ? state.elapsed / 6000 : finished ? 1 : 0
  const divert = state.phase === 'divert' ? state.elapsed / 2500 : ['descent', 'success', 'failure'].includes(state.phase) ? 1 : 0
  const pan = (51 - target.x) * divert
  const messages = {
    ready: 'Begin the approach, then respond to a scripted destination warning.',
    approach: 'Approaching the Moon. Initial destination locked. Warning event triggers after two seconds.',
    decision: 'Planned zone flagged red by the scenario. Turn on the demo risk map, inspect a zone, and confirm a destination.',
    divert: `Executing illustrative course change toward ${target.name}.`,
    descent: `Descending toward ${target.name}. This is an animation, not flight dynamics.`,
    success: 'Demo landing successful. You selected the route supported by the scripted scenario.',
    failure: 'Demo landing failed. You selected a route unsupported by the scripted scenario.',
  }
  return <main id="adaptive-simulation" className="adaptive-page" tabIndex={-1}>
    <div className="adaptive-title"><div><span className="eyebrow">INTERACTIVE SCENARIO / FIRST-PERSON VIEW</span><h1>Adaptive Landing Simulation</h1><p>Practice a destination change during approach.</p></div><a href="#/landing-demo">Original Landing Demo</a></div>
    <div className="adaptive-disclaimer"><AlertTriangle size={18} /><p><strong>SCRIPTED DEMO ONLY.</strong> Colours, events, terrain, trajectory and endings are fictional. No AI inference, real navigation, physics, RF assessment, or landing-safety prediction is performed.</p></div>
    <p className="adaptive-context">Planning context: {siteName} / {date} UTC date. Scenario zones use fictional screen positions, not coordinates or measured terrain from that site.</p>
    <div className="adaptive-workspace">
      <section className={`adaptive-viewport phase-${state.phase}`} aria-label="Illustrative first-person spacecraft view" style={{ '--moon-scale': 1 + approach * .3 + descent * 1.4, '--moon-pan': `${pan}%` } as CSSProperties}>
        <div className="adaptive-stars" aria-hidden="true" />
        <div className="adaptive-moon" aria-hidden="true"><div className="adaptive-moon-light" />{Array.from({ length: 30 }, (_, i) => <i key={i} className="adaptive-crater" style={{ left: `${8 + i * 37 % 80}%`, top: `${8 + i * 23 % 80}%`, width: `${3 + i % 7}%` }} />)}</div>
        <div className="adaptive-hud-top"><span>LN / APPROACH CAMERA <small>DEMO</small></span><span>{state.paused ? 'PAUSED' : state.phase.toUpperCase()}</span></div>
        <div className="adaptive-sight" aria-hidden="true"><Crosshair size={68} /><span>CAMERA BORESIGHT</span></div>
        <div className="adaptive-pitch" aria-hidden="true"><span>+ 20</span><i /><span>+ 10</span><i /><span>0</span><i /><span>- 10</span></div>
        <svg className="adaptive-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={`M 50 95 Q ${50 + pan / 3} 75 ${state.phase === 'decision' || state.phase === 'approach' ? 51 : target.x} ${target.y}`} fill="none" stroke="#8bdaef" strokeWidth=".4" strokeDasharray="2 2" /></svg>
        <div className="adaptive-zones">
          {demoDestinations.map(zone => {
            if (!state.map && zone.id !== state.destination) return null
            const warned = state.phase !== 'ready' && state.phase !== 'approach'
            const color = state.map || (zone.id === 'planned' && warned) ? zone.tone : 'neutral'
            return <button key={zone.id} type="button" className={`adaptive-zone zone-${color}`} style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
              disabled={state.phase !== 'decision'} onClick={() => dispatch({ type: 'choose', id: zone.id })}
              aria-label={`Inspect ${zone.name}. ${zone.supported ? 'Supported demo route' : 'Unsupported demo route'}`}>
              <span>{state.map || warned ? zone.symbol : '+'}</span><strong>{zone.name}</strong><small>{state.map ? 'DEMO FIXTURE' : warned ? 'SCENARIO WARNING' : 'INITIAL TARGET'}</small>
            </button>
          })}
        </div>
        {(state.phase === 'decision' || finished) && <div className={`adaptive-event ${finished ? 'terminal' : ''}`} role="status"><strong>{state.phase === 'decision' ? 'DESTINATION ALERT / DEMO' : state.phase === 'success' ? 'DEMO LANDING SUCCESSFUL' : 'DEMO LANDING FAILED'}</strong><p>{messages[state.phase]}</p></div>}
        <div className="adaptive-cockpit" aria-hidden="true"><i /><span>LUNANAV / SCENARIO TRAINER</span><i /></div>
      </section>
      <aside className="adaptive-console">
        <h2><Navigation size={18} /> Scenario control</h2>
        <p role="status" aria-live="polite">{messages[state.phase]}</p>
        <div className="adaptive-controls">
          <button type="button" disabled={state.phase !== 'ready'} onClick={() => dispatch({ type: 'start' })}><Play size={15} /> Start approach</button>
          <button type="button" disabled={!moving} onClick={() => dispatch({ type: 'pause' })}>{state.paused ? <Play size={15} /> : <Pause size={15} />}{state.paused ? 'Resume' : 'Pause'}</button>
          <button type="button" onClick={() => dispatch({ type: 'reset' })}><RotateCcw size={15} /> Reset scenario</button>
          <button type="button" aria-pressed={state.map} onClick={() => dispatch({ type: 'map' })}><Layers size={15} /> Demo risk map: {state.map ? 'ON' : 'OFF'}</button>
        </div>
        <ul className="adaptive-legend"><li><span className="green">+</span> Green: scripted supported route</li><li><span className="orange">!</span> Orange: scripted unsupported alternative</li><li><span className="red">x</span> Red: scripted rejected destination</li><li><span className="grey">?</span> Unmarked surface: no evaluated data</li></ul>
        <p className="adaptive-note">The demo planner is a fixed scenario rule, not an AI or scientific model. Green does not establish real landing suitability.</p>
        {state.phase === 'decision' && <div className="adaptive-destinations"><h3>Inspect a destination</h3>{demoDestinations.map(zone => <button key={zone.id} type="button" onClick={() => dispatch({ type: 'choose', id: zone.id })}>{zone.symbol} {zone.name}{zone.id === 'planned' ? ' - not recommended in demo' : ''}</button>)}</div>}
        <ol className="adaptive-steps"><li>Start approach</li><li>Scripted warning after 2 seconds</li><li>Toggle demo map and inspect a zone</li><li>Confirm or cancel your course change</li><li>Watch the scripted landing outcome</li></ol>
        {finished && <div className="adaptive-debrief"><h3>Scenario debrief</h3><p>{target.reason}</p><p>Outcome rule: only Alternate Alpha is scripted to complete successfully. No real landing capability has been tested.</p><button type="button" onClick={() => dispatch({ type: 'reset' })}>Try another route</button></div>}
      </aside>
    </div>
    <dialog ref={dialog} className="adaptive-dialog" aria-labelledby="divert-title" onCancel={event => { event.preventDefault(); dispatch({ type: 'cancel' }) }}>
      <h2 id="divert-title">Confirm destination change?</h2>
      {proposal && <><h3>{proposal.name}</h3><p>{proposal.reason}</p><p><strong>{proposal.supported ? 'Supported by the scripted demo planner.' : 'Not recommended by the scripted demo planner. This route produces the failure ending.'}</strong></p><p>This choice changes the fictional animation only. No spacecraft commands are sent.</p><div className="adaptive-controls"><button type="button" autoFocus onClick={() => dispatch({ type: 'cancel' })}>Cancel / keep reviewing</button><button type="button" onClick={() => dispatch({ type: 'confirm' })}>Confirm route</button></div></>}
    </dialog>
  </main>
}
