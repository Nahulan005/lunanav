import { lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import { Crosshair, Layers, Pause, Play, RotateCcw, Navigation, AlertTriangle } from 'lucide-react'
import { demoDestinations, initialScenario, scenarioReducer } from './scenario'
import { OrbitalBackdrop } from '../../components/OrbitalBackdrop'
import './adaptive.css'

const MoonScene = lazy(() => import('../moon3d/MoonScene'))

const smooth = (value: number) => value * value * (3 - 2 * value)
const eventPlan = [
  { phase: 'approach', time: '00.0 s', event: 'Approach begins' },
  { phase: 'decision', time: '02.0 s', event: 'Destination warning · clock holds for review' },
  { phase: 'divert', time: '02.0 s', event: 'Destination confirmed' },
  { phase: 'descent', time: '04.5 s', event: 'Final descent begins' },
  { phase: 'success', time: '10.5 s', event: 'Scenario outcome' },
] as const

export function AdaptiveSimulation({ siteName, date }: { siteName: string; date: string }) {
  const [state, dispatch] = useReducer(scenarioReducer, initialScenario)
  const scene = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [sceneStatus, setSceneStatus] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const onSceneReady = useCallback(() => setSceneStatus('ready'), [])
  const onSceneUnavailable = useCallback(() => setSceneStatus('fallback'), [])
  useEffect(() => {
    if (!scene.current) return
    const observer = new ResizeObserver(([{ contentRect }]) => {
      setViewport({ width: contentRect.width, height: contentRect.height })
    })
    observer.observe(scene.current)
    return () => observer.disconnect()
  }, [])

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
  const review = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (proposal) review.current?.focus()
  }, [proposal])
  const choose = (id: typeof target.id, trigger: HTMLButtonElement) => {
    returnFocus.current = trigger
    dispatch({ type: 'choose', id })
  }
  const cancelReview = () => {
    dispatch({ type: 'cancel' })
    returnFocus.current?.focus()
  }
  const approach = state.phase === 'ready' ? 0 : state.phase === 'approach' ? state.elapsed / 2000 : 1
  const descent = state.phase === 'descent' ? state.elapsed / 6000 : finished ? 1 : 0
  const divert = state.phase === 'divert' ? state.elapsed / 2500 : (state.phase === 'descent' || finished) ? 1 : 0
  // Offsets are in Moon radii so the markers and decorative surface share the camera.
  const offset = (zone: typeof target) => ({ x: (zone.x - 51) / 45, y: (zone.y - 63) / 45 })
  const targetOffset = offset(target)
  const openingRadius = Math.min(viewport.width * .33, viewport.height * .32)
  const decisionRadius = Math.min(openingRadius * 1.48, viewport.width * .75)
  const divertRadius = decisionRadius * 1.12
  // Reserve enough lunar surface to cover every corner when centered on this target.
  const cornerDistance = Math.hypot(viewport.width, viewport.height) / 2
  const finalRadius = Math.max(divertRadius, cornerDistance * 1.06 / (1 - Math.hypot(targetOffset.x, targetOffset.y)))
  const radius = openingRadius + (decisionRadius - openingRadius) * smooth(approach)
    + (divertRadius - decisionRadius) * smooth(divert) + (finalRadius - divertRadius) * smooth(descent)
  const panX = -targetOffset.x * radius * smooth(divert)
  const panY = -targetOffset.y * radius * smooth(divert)
  const markerPosition = (zone: typeof target) => {
    const point = offset(zone)
    return {
      left: `calc(50% + ${panX + point.x * radius}px)`,
      top: `calc(50% + ${panY + point.y * radius}px)`,
    }
  }
  const destinationPosition = markerPosition(target)
  const elapsed = state.phase === 'approach' ? state.elapsed / 1000 : state.phase === 'decision' ? 2
    : state.phase === 'divert' ? 2 + state.elapsed / 1000 : state.phase === 'descent' ? 4.5 + state.elapsed / 1000
      : finished ? 10.5 : 0
  const activePhase = finished ? 'success' : state.phase
  const messages = {
    ready: 'Begin the approach, then respond to a scripted destination warning.',
    approach: 'Approaching the Moon. Initial destination locked. Warning event triggers after two seconds.',
    decision: 'Planned zone flagged red by the scenario. Select a marker on the Moon, then confirm your destination.',
    divert: target.id === 'planned' ? 'Planned destination confirmed. Continuing the illustrative approach.'
      : `Executing illustrative course change toward ${target.name}.`,
    descent: `Descending toward ${target.name}. This is an animation, not flight dynamics.`,
    success: target.id === 'planned' ? 'The scripted descent reached the original planned destination.'
      : `The scripted descent reached ${target.name} after diverting.`,
    failure: 'The scripted descent to Alternate Bravo ended unsuccessfully.',
  }
  const outcomeTitle = state.phase === 'success' ? 'Landing successful' : 'Landing failed'
  return <main id="adaptive-simulation" className="adaptive-page" tabIndex={-1}>
    <div className="adaptive-title"><div><span className="eyebrow">INTERACTIVE SCENARIO / FIRST-PERSON VIEW</span><h1>Adaptive Landing Simulation</h1><p>Practice a destination change during approach.</p></div><a href="#/landing-demo">Original Landing Demo</a></div>
    <div className="adaptive-disclaimer"><AlertTriangle size={18} /><p><strong>SCRIPTED DEMO ONLY.</strong> Colours, events, terrain, trajectory and endings are fictional. No AI inference, real navigation, physics, RF assessment, or landing-safety prediction is performed.</p></div>
    <p className="adaptive-context">Planning context: {siteName} / {date} UTC date. Scenario zones use fictional screen positions, not coordinates or measured terrain from that site.</p>
    <div className="adaptive-workspace">
      <section className={`adaptive-viewport phase-${state.phase}`} aria-label="Illustrative first-person spacecraft view" style={{ '--moon-diameter': `${radius * 2}px`, '--moon-pan-x': `${panX}px`, '--moon-pan-y': `${panY}px` } as CSSProperties}>
        <OrbitalBackdrop />
        <div ref={scene} className="adaptive-moon-container" aria-hidden="true">
          {sceneStatus !== 'ready' && <div className="adaptive-moon"><div className="adaptive-moon-light" />{Array.from({ length: 30 }, (_, i) => <i key={i} className="adaptive-crater" style={{ left: `${8 + i * 37 % 80}%`, top: `${8 + i * 23 % 80}%`, width: `${3 + i % 7}%` }} />)}</div>}
          {radius > 0 && sceneStatus !== 'fallback' && <Suspense fallback={null}><MoonScene size={radius / .44} frameOffset={{ x: panX, y: panY }}
            rotationX={-.35} rotationY={-.32}
            onReady={onSceneReady} onUnavailable={onSceneUnavailable} /></Suspense>}
        </div>
        <div className="adaptive-hud-top"><span>LN / APPROACH CAMERA <small>DEMO</small></span><span>T+ {elapsed.toFixed(1)} s · {state.paused ? 'PAUSED' : state.phase.toUpperCase()}</span></div>
        <div className="adaptive-sight" aria-hidden="true"><Crosshair size={68} /><span>CAMERA BORESIGHT</span></div>
        <div className="adaptive-pitch" aria-hidden="true"><span>+ 20</span><i /><span>+ 10</span><i /><span>0</span><i /><span>- 10</span></div>
        {!finished && <div className="adaptive-route-pin" aria-hidden="true" style={destinationPosition} />}
        <div className="adaptive-zones">
          {radius > 0 && demoDestinations.map(zone => {
            if (state.phase !== 'decision' && zone.id !== state.destination) return null
            const planned = zone.id === 'planned'
            const warning = planned && state.phase === 'decision'
            const color = warning ? zone.tone : state.map && !planned ? zone.tone : 'neutral'
            return <button key={zone.id} type="button" className={`adaptive-zone zone-${color}`} style={markerPosition(zone)}
              disabled={state.phase !== 'decision'} onClick={event => choose(zone.id, event.currentTarget)}
              aria-label={`Inspect ${zone.name}`}>
              <span>{color === 'neutral' ? '+' : zone.symbol}</span><strong>{zone.name}</strong><small>{state.phase === 'decision' ? 'SELECT DESTINATION' : 'ACTIVE TARGET'}</small>
            </button>
          })}
        </div>
        {proposal && <div ref={review} className="adaptive-event adaptive-review" tabIndex={-1} aria-labelledby="divert-title"
          onKeyDown={event => { if (event.key === 'Escape') cancelReview() }}>
          <strong id="divert-title">Review destination: {proposal.name}</strong>
          <p>{proposal.reason}</p>
          <div className="adaptive-controls">
            <button type="button" onClick={cancelReview}>Keep reviewing</button>
            <button type="button" onClick={() => dispatch({ type: 'confirm' })}>{proposal.id === 'planned' ? 'Keep planned destination' : 'Confirm route'}</button>
          </div>
        </div>}
        {state.phase === 'decision' && !proposal && <div className="adaptive-event" role="status"><strong>DESTINATION ALERT / DEMO</strong><p>{messages.decision}</p></div>}
        {finished && <div className="adaptive-outcome" role="status">
          {state.phase === 'success' ? <Crosshair aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
          <div><small>SCRIPTED SCENARIO · {target.name}</small>
            <h2>{outcomeTitle}</h2>
            <p>{messages[state.phase]}</p>
          </div>
        </div>}
        <div className="adaptive-cockpit" aria-hidden="true"><i /><span>LUNANAV / SCENARIO TRAINER</span><i /></div>
      </section>
      <aside className="adaptive-console">
        <h2><Navigation size={18} /> Scenario control</h2>
        <p role="status" aria-live="polite">{messages[state.phase]}</p>
        <p className="adaptive-note">{sceneStatus === 'ready' ? '3D Moon · illustrative surface' : sceneStatus === 'fallback' ? '2D Moon · WebGL unavailable' : 'Loading 3D Moon…'} · Target: {target.name}</p>
        <div className="adaptive-controls">
          <button type="button" disabled={state.phase !== 'ready'} onClick={() => dispatch({ type: 'start' })}><Play size={15} /> Start approach</button>
          <button type="button" disabled={!moving} onClick={() => dispatch({ type: 'pause' })}>{state.paused ? <Play size={15} /> : <Pause size={15} />}{state.paused ? 'Resume' : 'Pause'}</button>
          <button type="button" onClick={() => dispatch({ type: 'reset' })}><RotateCcw size={15} /> Reset scenario</button>
          <button type="button" aria-pressed={state.map} onClick={() => dispatch({ type: 'map' })}><Layers size={15} /> Demo risk map: {state.map ? 'ON' : 'OFF'}</button>
        </div>
        <ul className="adaptive-legend"><li><span className="green">+</span> Green: scripted completed descent</li><li><span className="orange">!</span> Orange: scripted unsuccessful descent</li><li><span className="red">x</span> Red: planned destination warning</li><li><span className="grey">?</span> Unmarked surface: no evaluated data</li></ul>
        <p className="adaptive-note">The demo planner is a fixed scenario rule, not an AI or scientific model. Green does not establish real landing suitability.</p>
        {state.phase === 'decision' && <div className="adaptive-destinations"><h3>Inspect a destination</h3>{demoDestinations.map(zone => <button key={zone.id} type="button" onClick={event => choose(zone.id, event.currentTarget)}>{zone.symbol} {zone.name}{zone.id === 'planned' ? ' - warning in demo' : ''}</button>)}</div>}
        <div className="mission-table-scroll adaptive-event-plan" tabIndex={0} aria-label="Scenario event plan">
          <table><caption>Scenario event plan</caption><thead><tr><th scope="col">T+</th><th scope="col">Event</th></tr></thead>
            <tbody>{eventPlan.map(row => <tr key={row.phase} aria-current={row.phase === activePhase ? 'step' : undefined}>
              <td>{row.time}</td><td>{row.event}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {finished && <div className="adaptive-debrief"><h3>Scenario debrief</h3><p>{target.reason}</p><p>The demo allows a completed descent on the original route or after diverting to Alternate Alpha. Alternate Bravo illustrates an unsuccessful descent.</p><button type="button" onClick={() => dispatch({ type: 'reset' })}>Try another route</button></div>}
      </aside>
    </div>
  </main>
}
