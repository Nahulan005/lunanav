import { Activity, type LucideIcon } from 'lucide-react'

interface Props { label: string; value: number; detail: string; icon: LucideIcon; tone: string; code: string }
export function MetricCard({ label, value, detail, icon: Icon, tone, code }: Props) {
  return <article className={`metric-card ${tone}`}>
    <div className="metric-heading"><span className="telemetry-icon"><Icon size={20} strokeWidth={1.5} aria-hidden="true" /></span><div><span className="metric-code">{code} / DEMO ESTIMATE</span><h3>{label}</h3></div><Activity size={14} className="telemetry-activity" aria-hidden="true" /></div>
    <div className="metric-value">{value}<span>%</span><span className="metric-tag"><i />ILLUSTRATIVE</span></div>
    <div className="meter" aria-hidden="true"><span style={{ width: `${value}%` }} /></div>
    <p>{detail}</p>
  </article>
}
