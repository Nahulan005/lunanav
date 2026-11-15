import { useEffect, useState } from 'react'
import { Box, Orbit } from 'lucide-react'
import { workspaceTabs, workspaceTabForHash } from './workspaceNavigation'

interface MissionHeaderProps {
  loading: boolean
  dirty: boolean
  date: string
  backendConnected: boolean
  isOutOfCoverage?: boolean
}

export function MissionHeader({ backendConnected }: MissionHeaderProps) {
  const [active, setActive] = useState(window.location.hash || '#/overview')
  useEffect(() => {
    const updateActive = () => setActive(window.location.hash || '#/overview')
    updateActive()
    window.addEventListener('hashchange', updateActive)
    return () => window.removeEventListener('hashchange', updateActive)
  }, [])
  const links = workspaceTabs

  const isConnectedAndInCoverage = backendConnected
  const statusText = backendConnected ? 'Backend connected' : 'Backend unavailable / demo analysis'


  return <>
    <header className="topbar">
      <div className="nav-inner">
        <a className="brand" href="#/overview" aria-label="LunaNav home"><span className="brand-orbit"><Orbit size={28} /></span>LUNA<span>NAV</span></a>
        <nav aria-label="Mission workspace">
          {links.map(({ label, target }) => <a key={label} href={target} className={workspaceTabForHash(active) === workspaceTabForHash(target) && !active.includes('landing-3d') && active !== '#/landing-demo' ? 'active' : ''} aria-current={workspaceTabForHash(active) === workspaceTabForHash(target) && !active.includes('landing-3d') && active !== '#/landing-demo' ? 'page' : undefined}>{label}</a>)}
          <a href="#/landing-3d" className={(active === '#/landing-3d' || active === '#landing-3d') ? 'active' : ''} aria-current={(active === '#/landing-3d' || active === '#landing-3d') ? 'page' : undefined}><Box size={12} />3D Landing<span className="planned-label">DEMO</span></a>
          <a href="#/landing-demo" className={active === '#/landing-demo' ? 'active' : ''} aria-current={active === '#/landing-demo' ? 'page' : undefined}>Landing Demo<span className="planned-label">MOCK</span></a>
        </nav>
        <span className={`workspace-badge ${isConnectedAndInCoverage ? 'connected' : 'fallback'}`} role="status">
          <i className={`status-light ${isConnectedAndInCoverage ? 'connected' : 'fallback'}`} />
          {statusText}
        </span>
      </div>
    </header>
  </>
}
