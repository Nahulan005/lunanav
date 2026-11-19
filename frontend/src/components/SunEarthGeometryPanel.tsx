import { useEffect, useState } from 'react'
import { Globe2, LoaderCircle, Sun } from 'lucide-react'
import type { AnalysisRequest } from '../data/mockData'
import { fetchSunEarthGeometry, geometryConfigured, type SunEarthGeometryResponse } from '../services/geometry'

export interface GeometryPanelState {
  requestKey: string
  response: SunEarthGeometryResponse | null
  loading: boolean
}

export function SunEarthGeometryPanel({ request, onStateChange, initialState }: {
  request: AnalysisRequest
  onStateChange?: (state: GeometryPanelState) => void
  initialState?: GeometryPanelState | null
}) {
  const [cached] = useState(() => initialState?.requestKey === JSON.stringify(request) && !initialState.loading ? initialState : null)
  const [response, setResponse] = useState<SunEarthGeometryResponse | null>(cached?.response ?? null)
  const [loading, setLoading] = useState(!cached && geometryConfigured)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const { latitude, longitude, landingDate, siteId } = request
  const requestKey = JSON.stringify(request)

  useEffect(() => {
    onStateChange?.({ requestKey, response, loading })
  }, [onStateChange, requestKey, response, loading])

  useEffect(() => {
    if (cached && attempt === 0) return
    if (!geometryConfigured) return
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude)
      || Math.abs(longitude) > 180 || !/^\d{4}-\d{2}-\d{2}$/.test(landingDate)) {
      setLoading(false)
      setError('Select valid coordinates and a landing date.')
      return
    }
    let active = true
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    const debounce = setTimeout(() => {
      // The provider queries Sun and Earth sequentially; allow both bounded requests.
      timeout = setTimeout(() => controller.abort(), 20000)
      fetchSunEarthGeometry({ latitude, longitude, landingDate, siteId }, controller.signal)
        .then((data) => { if (active) setResponse(data) })
        .catch(() => { if (active) setError('Geometry unavailable, unsupported, or outside provider coverage.') })
        .finally(() => {
          clearTimeout(timeout)
          if (active) setLoading(false)
        })
    }, 300)
    return () => {
      active = false
      clearTimeout(debounce)
      clearTimeout(timeout)
      controller.abort()
    }
  }, [latitude, longitude, landingDate, siteId, attempt])

  const available = response?.status === 'available' && response.live_request_executed && response.observation !== null
  const sample = available ? response.observation : null
  const angle = (value: number | undefined) => value === undefined ? 'Unavailable' : `${value.toFixed(2)}°`
  return <section className="panel geometry-panel" aria-label="Sun and Earth geometry" aria-busy={loading}>
    <div className="geometry-heading">
      <h2><Sun size={17} />Sun &amp; Earth Geometry</h2>
      <span className={`small-badge ${sample ? '' : 'warning'}`} role="status">
        {loading ? <><LoaderCircle size={12} className="spin" /> Requesting geometry</> : sample ? 'Model-derived · Horizons response' : 'Unavailable'}
      </span>
    </div>
    <p className="geometry-provider">Provider status: {loading ? 'loading' : response?.status ?? 'unavailable'}
      {response && ` · ${response.provider_name}`}</p>
    <div className="geometry-readings">
      <div><Sun size={15} /><span>Sun azimuth<strong>{angle(sample?.sun.azimuth_deg)}</strong></span></div>
      <div><Sun size={15} /><span>Sun elevation<strong>{angle(sample?.sun.elevation_deg)}</strong></span></div>
      <div><Globe2 size={15} /><span>Earth azimuth<strong>{angle(sample?.earth.azimuth_deg)}</strong></span></div>
      <div><Globe2 size={15} /><span>Earth elevation<strong>{angle(sample?.earth.elevation_deg)}</strong></span></div>
    </div>
    <p className="geometry-epoch">UTC observation: {sample ? new Date(sample.timestamp_utc).toISOString().replace('T', ' ').replace('.000Z', ' UTC') : 'Not available'}</p>
    {!sample && !loading && <p className="geometry-note">{!geometryConfigured ? 'Backend geometry is not configured.' : error || response?.detail || 'No available model-derived observation.'} Existing dashboard estimates remain illustrative; no substitute geometry is shown.</p>}
    {geometryConfigured && <button type="button" className="moon3d-mode-button" disabled={loading} onClick={() => { setResponse(null); setError(''); setLoading(true); setAttempt(n => n + 1) }}>{loading ? 'Requesting geometry…' : 'Retry geometry request'}</button>}
    <p className="geometry-note">Model-derived apparent directions only, not scientifically validated here. No terrain masking, RF communication assessment, illumination-duration prediction, or landing-safety assessment.</p>
    {response && response.limitation_explanation.length > 0 && <details className="geometry-limitations">
      <summary>Provider limitations ({response.limitation_explanation.length})</summary>
      <ul>{response.limitation_explanation.map((text, index) => <li key={index}>{text}</li>)}</ul>
    </details>}
  </section>
}
