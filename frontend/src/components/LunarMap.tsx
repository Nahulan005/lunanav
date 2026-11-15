import { Crosshair, MapPin, Orbit, ScanLine } from 'lucide-react'
import { landingSites, moonCraters, type AnalysisRequest, type LandingSite } from '../data/mockData'

export function LunarMap({ selected, request, onSelect, disabled }: { selected: LandingSite; request: AnalysisRequest; onSelect: (site: LandingSite) => void; disabled: boolean }) {
  const coordinate = (value: number) => Number.isFinite(value) ? `${value.toFixed(2)}°` : '—'
  return <section className="panel lunar-map" aria-label="Illustrative lunar landing-site map">
    <div className="map-top"><span><Orbit size={16} />LUNAR SITE EXPLORER<span className="map-version">CONTEXT VIEW / 01</span></span><span className="small-badge">ILLUSTRATIVE SCHEMATIC</span></div>
    <div className="map-field">
      <div className="map-hud left-hud"><span>LUNAR SURFACE CONTEXT</span><strong>Explore a landing concept</strong><span>SELECT A PRESET TO CONFIGURE</span></div>
      <div className="map-hud right-hud"><ScanLine size={14} /><span>NO LIVE TELEMETRY</span></div>
      <div className="moon-stage">
        <div className="orbital-ring" /><div className="orbit-axis horizontal" /><div className="orbit-axis vertical" />
        <span className="compass-label north">N</span><span className="compass-label south">S</span><span className="compass-label west">W</span><span className="compass-label east">E</span>
        <div className="moon" aria-hidden="true">
          <div className="moon-maria" />
          <div className="crater-field">{moonCraters.map((crater, index) => <i className="crater" key={index} style={{ left: `${crater.x}%`, top: `${crater.y}%`, width: `${crater.size}%`, height: `${crater.size}%` }} />)}</div>
          <div className="moon-graticule">{[25, 50, 75].map((offset) => <span key={offset} className="latitude-line" style={{ top: `${offset}%` }} />)}{[28, 58, 86].map((width) => <span key={width} className="longitude-line" style={{ width: `${width}%` }} />)}</div>
          <div className="moon-terminator" />
        </div>
        {landingSites.map((site) => <button type="button" key={site.id} disabled={disabled} aria-label={`Select ${site.name}`} aria-pressed={selected.id === site.id} onClick={() => onSelect(site)} className={`site-marker ${site.id === selected.id ? 'selected' : ''} ${site.position[0] > 60 ? 'label-left' : ''}`} style={{ left: `${site.position[0]}%`, top: `${site.position[1]}%` }}><span className="marker-pin"><MapPin size={22} strokeWidth={1.5} /></span><span className="marker-label"><span className="marker-label-type">{selected.id === site.id ? 'SELECTED TARGET' : 'LANDING PRESET'}</span><strong>{site.name}</strong><span className="marker-coordinates">{coordinate(selected.id === site.id ? request.latitude : site.latitude)} / {coordinate(selected.id === site.id ? request.longitude : site.longitude)}</span></span></button>)}
      </div>
      <div className="map-scale"><span /><span>ILLUSTRATIVE · NOT TO SCALE</span></div>
      <span className="map-reticle"><Crosshair size={14} />LUNAR FRAME</span>
    </div>
    <div className="map-bottom"><span><i className="legend-dot green-dot" />Selected target<i className="legend-dot" />Preset site</span><span>Surface and marker positions are illustrative</span></div>
  </section>
}
