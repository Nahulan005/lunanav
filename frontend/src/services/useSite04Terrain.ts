import { useCallback, useEffect, useState } from 'react'
import { fetchSite04Footprint, fetchSite04Terrain, type GeographicPoint, type Site04Footprint, type Site04Terrain } from './site04Terrain'

function useSite04Request<T>(enabled: boolean, key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${key}:${attempt}`
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null }>()
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      controller.abort()
      setResult({ key: requestKey, data: null, error: 'Site04 request timed out. Retry to check again.' })
    }, 20_000)
    load(controller.signal)
      .then(data => { if (!controller.signal.aborted) setResult({ key: requestKey, data, error: null }) })
      .catch(error => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data: null, error: error instanceof Error ? error.message : 'Site04 request failed.' })
      })
      .finally(() => window.clearTimeout(timer))
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [enabled, requestKey, load])
  const current = enabled && result?.key === requestKey ? result : null
  return { data: current?.data ?? null, error: current?.error ?? null, loading: enabled && !current, retry: () => setAttempt(n => n + 1) }
}

export function useSite04Terrain(enabled: boolean, point: GeographicPoint | null) {
  const lat = point?.latitude, lon = point?.longitude
  const load = useCallback((signal: AbortSignal) => fetchSite04Terrain(
    lat === undefined || lon === undefined ? null : { latitude: lat, longitude: lon }, signal
  ), [lat, lon])
  return useSite04Request<Site04Terrain>(enabled, point ? `${lat},${lon}` : 'centre', load)
}

export function useSite04Footprint(enabled: boolean) {
  return useSite04Request<Site04Footprint>(enabled, 'footprint', fetchSite04Footprint)
}
