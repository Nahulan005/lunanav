import { Clock3, Radio, Sun } from 'lucide-react'
import { timeline } from '../data/mockData'

export function MissionTimeline({ date }: { date: string }) {
  return <section className="panel timeline-panel" id="timeline">
    <div className="section-heading"><div><h2><Clock3 size={17} />Mission visibility timeline</h2><p>7 Earth days · {date} UTC · illustrative sample periods</p></div><div className="chart-legend"><span><Sun size={12} className="sun-text" />Sunlight</span><span><Radio size={12} className="earth-text" />Earth visible</span><span><i className="legend-dot blackout" />Blackout</span></div></div>
    <div className="timeline-scroll"><div className="timeline-chart">
      <div className="timeline-axis"><span>MISSION ELAPSED</span>{Array.from({ length: 7 }, (_, i) => <span key={i}>D{String(i + 1).padStart(2, '0')}<small>{i * 24}h</small></span>)}</div>
      {timeline.map((row) => <div className="timeline-row" key={row.kind}><span className="row-label"><i className={`legend-dot ${row.kind}`} />{row.label}<small>DEMO</small></span><div className="timeline-track">{row.segments.map(([start, end]) => <span key={start} className={`time-segment ${row.kind}`} style={{ left: `${start}%`, width: `${end - start}%` }} aria-label={`${row.label}: ${start}% to ${end}% of illustrative window`} />)}</div></div>)}
      <div className="chart-footer"><span>FIXED SAMPLE WINDOW</span><span>168h / END OF WINDOW</span></div>
    </div></div><p className="timeline-note"><span className="small-badge">DEMO CHART</span>Periods are shared sample fixtures; they are not calculated from coordinates, dates, or metric percentages.</p>
  </section>
}
