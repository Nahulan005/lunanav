import { useState } from 'react'
import { Box, CalendarDays, ChevronRight, Compass, Orbit } from 'lucide-react'

interface MissionHeaderProps {
  loading: boolean
  dirty: boolean
  date: string
  backendConnected: boolean
  isOutOfCoverage?: boolean
}

export function MissionHeader({ loading, dirty, date, backendConnected, isOutOfCoverage = false }: MissionHeaderProps) {
  const [active, setActive] = useState('Dashboard')
  const links = [
    { label: 'Dashboard', target: '#planner' },
    { label: 'Site Analysis', target: '#site-analysis' },
    { label: 'Compare Scenarios', target: '#scenarios' },
    { label: 'Mission Timeline', target: '#timeline' },
  ]

  const isConnectedAndInCoverage = backendConnected && !isOutOfCoverage
  const statusText = isOutOfCoverage
    ? 'Demo fallback — outside local LOLA coverage'
    : backendConnected
      ? 'Backend connected'
      : 'Demo data'

  return <>
    <header className="topbar">
      <div className="nav-inner">
        <a className="brand" href="#planner" aria-label="LunaNav home"><span className="brand-orbit"><Orbit size={28} /></span>LUNA<span>NAV</span></a>
        <nav aria-label="Mission workspace">
          {links.map(({ label, target }) => <a key={label} href={target} className={active === label ? 'active' : ''} onClick={() => setActive(label)} aria-current={active === label ? 'location' : undefined}>{label}</a>)}
          <button disabled title="Planned feature"><CalendarDays size={12} />Schedule Analyzer<span className="planned-label">PLANNED</span></button>
          <button disabled title="Planned feature"><Box size={12} />3D Landing<span className="planned-label">PLANNED</span></button>
        </nav>
        <span className={`workspace-badge ${isConnectedAndInCoverage ? 'connected' : 'fallback'}`} role="status">
          <i className={`status-light ${isConnectedAndInCoverage ? 'connected' : 'fallback'}`} />
          {statusText}
        </span>
      </div>
    </header>
    <div className="mission-strip">
      <span><Compass size={12} />MISSION CONTROL<ChevronRight size={11} /><strong>LUNAR OPERATIONS</strong></span>
      <span><i className={`status-light ${loading ? 'busy' : ''}`} />{loading ? 'ANALYZING MISSION…' : dirty ? 'CONFIGURATION MODIFIED' : 'WORKSPACE READY'}</span>
      <span>
        <i className={`status-light ${isConnectedAndInCoverage ? 'connected' : 'fallback'}`} />
        {statusText}
        <span className="strip-divider" />
        {date || 'DATE NOT SET'} UTC
      </span>
    </div>
  </>
}
