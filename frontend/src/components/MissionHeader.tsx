import { useEffect, useState } from 'react'
import { Box, Orbit, Home, Map, ScanLine, CalendarDays, Database, GitCompare, Rocket, Navigation } from 'lucide-react'
import { workspaceTabs, workspaceTabForHash } from './workspaceNavigation'

export function MissionHeader({ backendConnected, connectionPending }: { backendConnected: boolean; connectionPending: boolean }) {
  const [active, setActive] = useState(window.location.hash || '#/overview')
  useEffect(() => {
    const updateActive = () => setActive(window.location.hash || '#/overview')
    updateActive()
    window.addEventListener('hashchange', updateActive)
    return () => window.removeEventListener('hashchange', updateActive)
  }, [])
  const links = workspaceTabs
  const icons = [Home, Map, ScanLine, CalendarDays, Database, GitCompare]

  const statusText = connectionPending ? 'Checking API connection…' : backendConnected ? 'API reachable' : 'API health check failed'
  const moonActive = ['#/landing-3d', '#/landing-3d/site04', '#landing-3d'].includes(active)

  return <>
    <header className="topbar">
      <div className="nav-inner">
        <a className="brand" href="#/overview" aria-label="LunaNav home"><span className="brand-orbit"><Orbit size={28} /></span>LUNA<span>NAV</span></a>
        <nav aria-label="Mission workspace">
          {links.map(({ label, target }, index) => { const Icon = icons[index]; return <a key={label} href={target} className={workspaceTabForHash(active) === workspaceTabForHash(target) && !active.includes('landing-3d') && active !== '#/landing-demo' && active !== '#/adaptive-simulation' ? 'active' : ''} aria-current={workspaceTabForHash(active) === workspaceTabForHash(target) && !active.includes('landing-3d') && active !== '#/landing-demo' && active !== '#/adaptive-simulation' ? 'page' : undefined}><Icon size={16} />{label}</a> })}
          <a href="#/landing-3d" className={moonActive ? 'active' : ''} aria-current={moonActive ? 'page' : undefined}><Box size={16} />3D Landing</a>
          <a href="#/landing-demo" className={active === '#/landing-demo' ? 'active' : ''} aria-current={active === '#/landing-demo' ? 'page' : undefined}><Rocket size={16} />Landing Demo<span className="planned-label">MOCK</span></a>
          <a href="#/adaptive-simulation" className={active === '#/adaptive-simulation' ? 'active' : ''} aria-current={active === '#/adaptive-simulation' ? 'page' : undefined}><Navigation size={16} />Adaptive Simulation<span className="planned-label">SCRIPTED</span></a>
        </nav>
        <span className={`workspace-badge ${backendConnected ? 'connected' : 'fallback'}`} role="status">
          <i className={`status-light ${backendConnected ? 'connected' : 'fallback'}`} />
          {statusText}
        </span>
      </div>
    </header>
  </>
}
