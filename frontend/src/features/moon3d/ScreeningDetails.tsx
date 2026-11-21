import { useEffect, useState } from 'react'
import { fetchTerrainSample, isWithinLolaCoverage, type TerrainSample } from '../../services/analysis'
import { containsSite04Point, site04ToProjected, type GeographicPoint, type TerrainMetric } from '../../services/site04Terrain'
import { useSite04Footprint, useSite04Terrain } from '../../services/useSite04Terrain'
import { SunEarthGeometryPanel, type GeometryPanelState } from '../../components/SunEarthGeometryPanel'
import { GeometryTimeline } from '../../components/GeometryTimeline'

export type SurfaceLocation = GeographicPoint

function formatMetric(metric: TerrainMetric, uncertainty: TerrainMetric) {
  if (metric.status !== 'available' || metric.value === null) return `Unavailable · ${metric.status}`
  const unit = metric.unit === 'degree' ? '°' : ' m'
  const rms = uncertainty.status === 'available' && uncertainty.value !== null
    ? ` · RMS uncertainty ${uncertainty.value.toFixed(2)}${unit}` : ''
  return `${metric.value.toFixed(2)}${unit}${rms}`
}

export function ScreeningDetails({ location, date, siteId = 'custom', onSelect }: {
  location: SurfaceLocation
  date: string
  siteId?: string
  onSelect: (location: SurfaceLocation) => void
}) {
  const [pointResult, setPointResult] = useState<{ sample: TerrainSample | null; error?: string }>()
  const [geometry, setGeometry] = useState<GeometryPanelState | null>(null)
  const { latitude, longitude } = location
  const request = { latitude, longitude, siteId, landingDate: date }
  const requestKey = JSON.stringify(request)
  const matchingGeometry = geometry?.requestKey === requestKey ? geometry : null
  const response = matchingGeometry?.response
  const live = !matchingGeometry?.loading && response?.status === 'available' && response.live_request_executed
  const observation = live ? response.observation : null
  const observations = live ? response.observations : []

  const covered = isWithinLolaCoverage(latitude, longitude)
  const nearSouthPole = latitude <= -89
  const footprint = useSite04Footprint(true)
  const projected = nearSouthPole ? site04ToProjected(location) : null
  const insideSite04 = Boolean(projected && footprint.data && containsSite04Point(footprint.data.projected_bounds, projected))
  const prepared = useSite04Terrain(insideSite04, null)
  const preparedCell = projected && prepared.data?.cells.find(cell => containsSite04Point(cell.bounds, projected))
  const regional = useSite04Terrain(insideSite04 && !prepared.loading && !preparedCell, location)
  const regionalSelection = regional.data?.selection
  const regionalCell = projected && regionalSelection && regional.data?.cells.find(cell =>
    cell.row === regionalSelection.row && cell.column === regionalSelection.column && containsSite04Point(cell.bounds, projected))
  const site04Cell = preparedCell || regionalCell
  const sample = pointResult?.sample
  const terrainPending = (covered && !pointResult) || (nearSouthPole && footprint.loading) || prepared.loading || regional.loading
  const terrainError = pointResult?.error ?? (nearSouthPole ? footprint.error : null) ?? regional.error ?? regional.data?.detail ?? prepared.error
  const noTerrain = terrainPending ? 'Checking terrain coverage…' : terrainError ??
    (insideSite04 ? 'No matching Site04 terrain cell returned.' : 'Outside the available Apollo 17 cutout and Site04 terrain coverage.')

  useEffect(() => {
    if (!covered) return
    let active = true
    let error: string | undefined
    fetchTerrainSample(latitude, longitude, message => { error = message })
      .then(result => {
        if (active) setPointResult({ sample: result && !result.isFallback ? result.sample : null, error })
      })
    return () => { active = false }
  }, [latitude, longitude, covered])

  return <section className="screening-details" aria-label="Selected surface location details">
    <h3>Selected surface location</h3>
    <p>{latitude.toFixed(4)}° latitude / {longitude.toFixed(4)}° east longitude · {date} UTC</p>
    <div className="screening-decision-banner">
      <strong>Landing suitability · Not assessed</strong>
      <p>A recommendation requires verified local slope and terrain horizons, plus limits for the selected lander and mission.</p>
    </div>
    <div className="table-scroll"><table>
      <caption>Terrain and geometry at the selected coordinates</caption>
      <thead><tr><th>Metric</th><th>Value / source</th><th>What’s available</th></tr></thead>
      <tbody>
        <tr><th scope="row">Surface elevation</th>
          <td>{site04Cell ? formatMetric(site04Cell.elevation, site04Cell.elevation_rms_uncertainty) : sample ? `${sample.elevation_value} ${sample.units} · LOLA ${sample.product_name}` : noTerrain}</td>
          <td>{site04Cell ? 'Site04 SURF · provisional 5 m product' : sample ? 'Apollo 17 cutout · coarse containing-cell sample' : terrainPending ? 'Checking coverage' : 'Unavailable'}</td></tr>
        <tr><th scope="row">Local slope</th>
          <td>{site04Cell ? formatMetric(site04Cell.slope, site04Cell.slope_rms_uncertainty) : terrainPending ? 'Checking coverage…' : 'No Site04 slope cell for this point.'}</td>
          <td>{site04Cell ? 'Site04 SLP · provisional, slope baseline unresolved' : 'Landing-scale slope unavailable'}</td></tr>
        {(['sun', 'earth'] as const).map(target => {
          const angles = observations.map(sample => sample[target].elevation_deg)
          const above = angles.filter(angle => angle > 0).length
          const below = angles.filter(angle => angle < 0).length
          const on = angles.length - above - below
          return <tr key={target}>
            <th scope="row">{target === 'sun' ? 'Sun centre' : 'Earth centre'}</th>
            <td>{observation ? `${observation[target].azimuth_deg.toFixed(2)}° azimuth / ${observation[target].elevation_deg.toFixed(2)}° elevation at ${observation.timestamp_utc}` : matchingGeometry?.loading ? 'Requesting directions…' : 'No Horizons directions returned.'}</td>
            <td>{angles.length > 0 ? <><strong>{above} above · {below} below{on > 0 && ` · ${on} at 0°`}</strong><div>{angles.length} Horizons samples relative to the geometric horizon</div><div>Elevation range {Math.min(...angles).toFixed(2)}° to {Math.max(...angles).toFixed(2)}°</div></> : 'No sample summary available'}</td>
          </tr>
        })}
      </tbody>
    </table></div>
    <p>Sample counts describe the smooth-sphere horizon at the returned times. Terrain-aware sunlight duration and Earth clearance require a horizon profile by azimuth. Radio availability also needs a link budget.</p>
    {site04Cell && <p>Site04 source cell {site04Cell.row}, {site04Cell.column} · LOLA returns: {site04Cell.observation_status}. <a href="#/coverage">See terrain sources and limitations</a>.</p>}
    {sample && <details><summary>Point elevation provenance</summary>
      <p>{sample.source_name} · {sample.product_name} {sample.product_version}. Used cell centre: {sample.coordinate_used.latitude}°, {sample.coordinate_used.longitude}°. {sample.sampling_method}.</p>
      <p className="screening-checksum">Subset SHA-256: {sample.subset_checksum} · {sample.validation.status}</p>
    </details>}
    {(footprint.error || insideSite04 && !terrainPending && !site04Cell) && <button className="moon3d-mode-button" type="button" onClick={() => {
      if (footprint.error) footprint.retry()
      else { prepared.retry(); regional.retry() }
    }}>Retry Site04 terrain</button>}
    {footprint.data && !preparedCell && <p><button className="moon3d-mode-button" type="button" onClick={() => {
      if (footprint.data) onSelect(footprint.data.center)
    }}>Inspect Site04 centre coordinates</button></p>}
    <SunEarthGeometryPanel request={request} onStateChange={setGeometry} />
    <GeometryTimeline geometry={matchingGeometry} />
  </section>
}
