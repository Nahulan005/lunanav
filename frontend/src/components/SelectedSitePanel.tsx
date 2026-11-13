import { Crosshair, Info, MapPin, Radio, ShieldCheck } from 'lucide-react'
import type { AnalysisRequest, LandingSite } from '../data/mockData'

export function SelectedSitePanel({ site, request, loading, dirty }: { site: LandingSite; request: AnalysisRequest; loading: boolean; dirty: boolean }) {
  const coordinate = (value: number) => Number.isFinite(value) ? `${value.toFixed(2)}°` : '—'
  return <section className="panel site-panel" aria-label="Selected site analysis">
    <div className="section-heading"><h2><MapPin size={16} />Selected site info</h2><span className="panel-code">TARGET / 01</span></div>
    <div className="site-target"><span className="target-emblem"><Crosshair size={28} strokeWidth={1} /></span><div><div className="eyebrow">{site.region}</div><h3>{site.name}</h3></div></div>
    <div className="coordinate-readout"><div><span>LATITUDE</span><strong>{coordinate(request.latitude)}</strong></div><div><span>LONGITUDE</span><strong>{coordinate(request.longitude)}</strong></div></div>
    <div className="site-details"><div><span>Landing date</span><strong>{request.landingDate || '—'}</strong></div><div><span>Analysis window</span><strong>7 Earth days</strong></div><div><span>Reference frame</span><strong>Illustrative schematic</strong></div></div>
    <div className={`analysis-state ${dirty ? 'pending' : ''}`}><ShieldCheck size={17} /><div><span>MISSION STATUS</span><strong>{loading ? 'Loading sample analysis' : dirty ? 'Awaiting demo analysis' : 'Demo analysis available'}</strong></div><i className="status-light" /></div>
    <p className="site-description">{site.description}</p>
    <div className="site-notice"><Info size={13} /><span>Illustrative coordinates and surface. No operational assessment.</span></div>
    <div className="site-panel-footer"><Radio size={12} />DATA SOURCE<span>LOCAL DEMO FIXTURE</span></div>
  </section>
}
