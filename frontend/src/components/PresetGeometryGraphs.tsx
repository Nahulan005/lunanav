import { useEffect, useMemo, useState } from 'react'
import { MOON3D_LANDING_SITES } from '../features/moon3d/moon3dMockData'
import { fetchSunEarthGeometry, geometryConfigured } from '../services/geometry'
import type { AnalysisRequest } from '../data/mockData'
import type { GeometryPanelState } from './SunEarthGeometryPanel'
import { GeometryTimeline } from './GeometryTimeline'

function PresetGraph({ site, landingDate }: { site: typeof MOON3D_LANDING_SITES[number]; landingDate: string }) {
  const [expanded, setExpanded] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<GeometryPanelState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const request = useMemo<AnalysisRequest>(() => ({ siteId: site.id, latitude: site.latitude, longitude: site.longitude, landingDate }), [site, landingDate])
  const terrainNote = site.id === 'apollo17'
    ? 'Local point terrain: Apollo 17 LDEM_4 cutout available; about 7.6 km north–south spacing, too coarse for landing-scale crater or hazard assessment.'
    : 'Local point terrain: no matching LDEM_4 sample. Site04’s 5 m data is a separate south-polar footprint and is not used as a substitute here.'

  useEffect(() => {
    setState(null)
    setError(null)
  }, [landingDate])

  useEffect(() => {
    if (!expanded || !geometryConfigured) return
    const controller = new AbortController()
    let active = true
    const requestKey = JSON.stringify(request)
    setError(null)
    setState({ requestKey, response: null, loading: true })
    fetchSunEarthGeometry(request, controller.signal)
      .then(response => {
        if (!active) return
        if (!response) setError('Geometry service is not configured.')
        else setState({ requestKey, response, loading: false })
      })
      .catch(reason => {
        if (!active || controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : 'Geometry request failed.')
        setState({ requestKey, response: null, loading: false })
      })
    return () => { active = false; controller.abort() }
  }, [expanded, request, attempt])

  const reload = () => {
    if (expanded) setAttempt(value => value + 1)
    else setExpanded(true)
  }

  return <article className="preset-geometry-card">
    <div className="preset-geometry-card-heading">
      <div><h3>{site.name}</h3><p>{site.latitude.toFixed(2)}° / {site.longitude.toFixed(2)}° · {landingDate} UTC</p></div>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
        {expanded ? 'Hide graph' : 'Load geometry graph'}
      </button>
    </div>
    <p className="preset-geometry-terrain-note">{terrainNote}</p>
    {expanded && <div className="preset-geometry-card-body">
      {!geometryConfigured ? <p className="unavailable-message">The frontend has no configured geometry API URL.</p>
        : error ? <div role="status"><p className="unavailable-message">{error}</p><button type="button" onClick={reload}>Retry {site.name}</button></div>
          : state?.loading ? <p role="status">Requesting this site’s Sun and Earth samples from Horizons…</p>
            : state ? <GeometryTimeline geometry={state} /> : <p role="status">Preparing request…</p>}
    </div>}
  </article>
}

export function PresetGeometryGraphs({ landingDate }: { landingDate: string }) {
  return <section className="panel preset-geometry-graphs" aria-label="Sun and Earth geometry by 3D preset">
    <div className="section-heading"><div><h2>Sun &amp; Earth graphs for every 3D site</h2><p>Load a graph for each node at the selected UTC date.</p></div><span className="small-badge">ON-DEMAND · MODEL-DERIVED</span></div>
    <p className="tab-context-note">Each graph is a separate JPL Horizons request at that preset’s coordinates. It shows apparent centre elevation over 24 hours relative to a smooth geometric horizon. Terrain obstruction, safe landing areas, illumination duration and radio link quality are not inferred.</p>
    <div className="preset-geometry-list">{MOON3D_LANDING_SITES.map(site => <PresetGraph key={site.id} site={site} landingDate={landingDate} />)}</div>
  </section>
}
