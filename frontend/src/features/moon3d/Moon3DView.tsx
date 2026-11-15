import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { fetchSite04Coverage } from '../../services/analysis'
import type { Site04CoverageResponse } from './terrainGrid'
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Info,
  Layers,
  Orbit,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sun,
} from 'lucide-react'
import {
  HEATMAP_CONFIGS,
  LUNAR_CRATERS,
  LUNAR_MARIA,
  MOON3D_DISCLAIMER,
  MOON3D_LANDING_SITES,
  PROCEDURAL_CRATER_SEEDS,
  type HeatmapMode,
  type Moon3DLandingSite,
} from './moon3dMockData'
import './moon3d.css'
import { ScreeningDetails, type SurfaceLocation } from './ScreeningDetails'

interface ProjectedCoords {
  x: number
  y: number
  z: number
  screenX: number
  screenY: number
  visible: boolean
  scale: number
  opacity: number
}

const DEFAULT_ROT_X = 0.22 // ~12.6 degrees pitch
const DEFAULT_ROT_Y = -0.28 // ~-16 degrees yaw

function projectPoint(
  latDeg: number,
  lonDeg: number,
  rotX: number,
  rotY: number,
  radius: number,
  centerX: number,
  centerY: number
): ProjectedCoords {
  const phi = (latDeg * Math.PI) / 180
  const lambda = (lonDeg * Math.PI) / 180

  // Unit sphere coordinates (North is -y in canvas, East is +x)
  const x0 = Math.cos(phi) * Math.sin(lambda)
  const y0 = -Math.sin(phi)
  const z0 = Math.cos(phi) * Math.cos(lambda)

  // Rotate around Y axis (yaw / spin)
  const cosY = Math.cos(rotY)
  const sinY = Math.sin(rotY)
  const x1 = x0 * cosY + z0 * sinY
  const y1 = y0
  const z1 = -x0 * sinY + z0 * cosY

  // Rotate around X axis (pitch / tilt)
  const cosX = Math.cos(rotX)
  const sinX = Math.sin(rotX)
  const x2 = x1
  const y2 = y1 * cosX - z1 * sinX
  const z2 = y1 * sinX + z1 * cosX

  const screenX = centerX + x2 * radius
  const screenY = centerY + y2 * radius
  const visible = z2 > 0.05
  const scale = Math.max(0.72, Math.min(1.15, 0.78 + 0.32 * z2))
  const opacity = Math.max(0, Math.min(1, (z2 - 0.04) / 0.16))

  return { x: x2, y: y2, z: z2, screenX, screenY, visible, scale, opacity }
}

export function Moon3DView({ initialSelectedId, date = '2027-03-15' }: { initialSelectedId?: string; date?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const [rotX, setRotX] = useState<number>(DEFAULT_ROT_X)
  const [rotY, setRotY] = useState<number>(DEFAULT_ROT_Y)
  const [autoRotate, setAutoRotate] = useState<boolean>(false)
  const [showCoordinateGrid, setShowCoordinateGrid] = useState(false)
  type Selection = { kind: 'preset'; site: Moon3DLandingSite } | { kind: 'point'; latitude: number; longitude: number }
  const [selection, setSelection] = useState<Selection>(() => {
    const site = MOON3D_LANDING_SITES.find((item) => item.id === (initialSelectedId ?? 'shackleton'))
    return site ? { kind: 'preset', site } : { kind: 'point', latitude: 0, longitude: 0 }
  })
  const surface: SurfaceLocation = selection.kind === 'preset' ? selection.site : selection
  const setSurface = (point: SurfaceLocation) => setSelection({ kind: 'point', ...point })
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('none')
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 440,
    height: 440,
  })
    const [site04Coverage, setSite04Coverage] = useState<Site04CoverageResponse | null>(null)
  const [coverageLoading, setCoverageLoading] = useState(true)

  // Pointer drag state
  const isPointerDownRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number; rotX: number; rotY: number }>({
    x: 0,
    y: 0,
    rotX: DEFAULT_ROT_X,
    rotY: DEFAULT_ROT_Y,
  })
  const hasMovedSignificantlyRef = useRef(false)
  const dragSuppressionTimerRef = useRef<number | null>(null)

  const selectedSite = selection.kind === 'preset' ? selection.site : null
  const activeHeatmap = HEATMAP_CONFIGS[heatmapMode]
  const screening = heatmapMode === 'feasibility'
  const coverageStatus = coverageLoading
  ? 'Loading Site04 coverage...'
  : site04Coverage
    ? `Site04 coverage: ${site04Coverage.status ?? 'Unknown'}`
    : 'Site04 coverage API unavailable'

    // Fetch Site04 observation coverage from the backend
  useEffect(() => {
    let active = true

    fetchSite04Coverage()
      .then((data) => {
        if (active) setSite04Coverage(data)
      })
      .finally(() => {
        if (active) setCoverageLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // ResizeObserver for responsive canvas resolution
  useEffect(() => {
    const el = stageRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const side = Math.min(width || 440, height || 440, 520)
        setDimensions({ width: side, height: side })
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Auto-rotation animation loop
  useEffect(() => {
    if (!autoRotate) return
    let animId: number
    const step = () => {
      if (!isPointerDownRef.current) {
        setRotY((prev) => (prev + 0.003) % (Math.PI * 2))
      }
      animId = requestAnimationFrame(step)
    }
    animId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animId)
  }, [autoRotate])

  // Canvas render pass
  const drawMoon = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = dimensions.width
    canvas.width = size * dpr
    canvas.height = size * dpr

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, size, size)

    const cx = size / 2
    const cy = size / 2
    const radius = size * 0.44

    // Directional sunlight vector (from upper-left-front)
    const sunAzimuth = -0.7
    const sunElevation = 0.4
    const sunX = Math.cos(sunElevation) * Math.sin(sunAzimuth)
    const sunY = -Math.sin(sunElevation)

    // Outer atmospheric back-glow
    const backGlow = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.15)
    backGlow.addColorStop(0, 'rgba(88, 170, 255, 0.22)')
    backGlow.addColorStop(0.5, 'rgba(88, 170, 255, 0.07)')
    backGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = backGlow
    ctx.beginPath()
    ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2)
    ctx.fill()

    // Base Moon sphere clipping boundary
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.clip()

    // 1. Lunar Regolith Base Tone
    const baseGradient = ctx.createRadialGradient(
      cx - radius * 0.35,
      cy - radius * 0.3,
      radius * 0.1,
      cx,
      cy,
      radius
    )
    baseGradient.addColorStop(0, '#d2d8dc')
    baseGradient.addColorStop(0.35, '#a3abb0')
    baseGradient.addColorStop(0.7, '#6f7980')
    baseGradient.addColorStop(0.95, '#3b4751')
    baseGradient.addColorStop(1, '#1b2631')
    ctx.fillStyle = baseGradient
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)

    // 2. Render Lunar Maria (Basalt Plains)
    for (const mare of LUNAR_MARIA) {
      const proj = projectPoint(mare.latitude, mare.longitude, rotX, rotY, radius, cx, cy)
      if (proj.z > -0.15) {
        const mareRad = (mare.radiusKm / 1737.4) * radius
        const aspectZ = Math.max(0.25, proj.z)

        ctx.save()
        ctx.translate(proj.screenX, proj.screenY)
        ctx.scale(1, aspectZ)

        const mareGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, mareRad)
        mareGrad.addColorStop(0, `rgba(28, 38, 45, ${mare.opacity * 0.9})`)
        mareGrad.addColorStop(0.65, `rgba(38, 50, 58, ${mare.opacity * 0.6})`)
        mareGrad.addColorStop(1, 'transparent')

        ctx.fillStyle = mareGrad
        ctx.beginPath()
        ctx.arc(0, 0, mareRad, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    // 3. Render Tycho and Copernicus Ray Streaks
    for (const crater of LUNAR_CRATERS) {
      if (!crater.hasRays) continue
      const proj = projectPoint(crater.latitude, crater.longitude, rotX, rotY, radius, cx, cy)
      if (proj.z > 0.05) {
        ctx.save()
        const rayCount = 10
        for (let i = 0; i < rayCount; i++) {
          const angle = (i * Math.PI * 2) / rayCount + (crater.latitude > 0 ? 0.3 : -0.2)
          const rayLen = radius * 0.45 * (0.8 + 0.4 * Math.sin(i * 1.7))
          const ex = proj.screenX + Math.cos(angle) * rayLen
          const ey = proj.screenY + Math.sin(angle) * rayLen * Math.max(0.3, proj.z)

          const rayGrad = ctx.createLinearGradient(proj.screenX, proj.screenY, ex, ey)
          rayGrad.addColorStop(0, 'rgba(235, 243, 248, 0.45)')
          rayGrad.addColorStop(0.3, 'rgba(215, 227, 235, 0.22)')
          rayGrad.addColorStop(1, 'transparent')

          ctx.strokeStyle = rayGrad
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(proj.screenX, proj.screenY)
          ctx.lineTo(ex, ey)
          ctx.stroke()
        }
        ctx.restore()
      }
    }

    // 4. Render Procedural Highland Craters (Background Depth)
    for (const seed of PROCEDURAL_CRATER_SEEDS) {
      const proj = projectPoint(seed.lat, seed.lon, rotX, rotY, radius, cx, cy)
      if (proj.z > 0.05) {
        const cr = (seed.rad / 1737.4) * radius
        const aspectZ = Math.max(0.2, proj.z)

        ctx.save()
        ctx.translate(proj.screenX, proj.screenY)
        ctx.scale(1, aspectZ)

        // Shadow interior
        ctx.fillStyle = 'rgba(20, 31, 39, 0.55)'
        ctx.beginPath()
        ctx.arc(0, 0, Math.max(1.2, cr), 0, Math.PI * 2)
        ctx.fill()

        // Sunlit rim arc
        ctx.strokeStyle = 'rgba(230, 238, 244, 0.4)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.arc(0, 0, Math.max(1.2, cr), -Math.PI * 0.8, -Math.PI * 0.1)
        ctx.stroke()

        ctx.restore()
      }
    }

    // 5. Render Named Craters (High Relief with Highlights & Rim Shadows)
    for (const crater of LUNAR_CRATERS) {
      const proj = projectPoint(crater.latitude, crater.longitude, rotX, rotY, radius, cx, cy)
      if (proj.z > 0.04) {
        const cr = Math.max(2.5, (crater.radiusKm / 1737.4) * radius)
        const aspectZ = Math.max(0.22, proj.z)

        ctx.save()
        ctx.translate(proj.screenX, proj.screenY)
        ctx.scale(1, aspectZ)

        // Inner crater floor shadow
        const floorGrad = ctx.createRadialGradient(
          cr * 0.25,
          cr * 0.25,
          cr * 0.1,
          0,
          0,
          cr
        )
        floorGrad.addColorStop(0, 'rgba(10, 18, 26, 0.85)')
        floorGrad.addColorStop(0.7, 'rgba(25, 36, 45, 0.75)')
        floorGrad.addColorStop(1, 'rgba(60, 75, 85, 0.35)')

        ctx.fillStyle = floorGrad
        ctx.beginPath()
        ctx.arc(0, 0, cr, 0, Math.PI * 2)
        ctx.fill()

        // Sunward rim highlight
        ctx.strokeStyle = 'rgba(245, 250, 255, 0.75)'
        ctx.lineWidth = Math.max(1.2, cr * 0.12)
        ctx.beginPath()
        ctx.arc(0, 0, cr, -Math.PI * 0.9, -Math.PI * 0.15)
        ctx.stroke()

        // Leeward shadowed rim
        ctx.strokeStyle = 'rgba(12, 20, 28, 0.8)'
        ctx.lineWidth = Math.max(1.1, cr * 0.1)
        ctx.beginPath()
        ctx.arc(0, 0, cr, Math.PI * 0.1, Math.PI * 0.85)
        ctx.stroke()

        // Central peak for large impact craters
        if (crater.radiusKm > 70) {
          ctx.fillStyle = 'rgba(235, 245, 252, 0.7)'
          ctx.beginPath()
          ctx.arc(0, 0, Math.max(0.8, cr * 0.1), 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.restore()
      }
    }

    // 8. 3D Spherical Volume Shading & Realistic Terminator
    // Calculates illumination falloff across the hemisphere
    const termGrad = ctx.createRadialGradient(
      cx + sunX * radius * 0.6,
      cy + sunY * radius * 0.6,
      radius * 0.15,
      cx,
      cy,
      radius
    )
    termGrad.addColorStop(0, 'rgba(255, 255, 255, 0.14)')
    termGrad.addColorStop(0.45, 'rgba(20, 35, 50, 0.05)')
    termGrad.addColorStop(0.72, 'rgba(10, 22, 36, 0.65)')
    termGrad.addColorStop(0.95, 'rgba(3, 8, 16, 0.94)')
    termGrad.addColorStop(1, 'rgba(2, 5, 12, 0.98)')
    ctx.fillStyle = termGrad
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)

    // Limb darkening (spherical grazing angle falloff)
    const limbGrad = ctx.createRadialGradient(cx, cy, radius * 0.78, cx, cy, radius)
    limbGrad.addColorStop(0, 'transparent')
    limbGrad.addColorStop(0.85, 'rgba(4, 12, 22, 0.45)')
    limbGrad.addColorStop(1, 'rgba(2, 6, 12, 0.85)')
    ctx.fillStyle = limbGrad
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)

    ctx.restore() // Undo sphere clipping

    // 9. Rim Specular Arc & Crisp Boundary
    ctx.save()
    ctx.strokeStyle = 'rgba(145, 198, 235, 0.45)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    ctx.restore() // Undo base save
  }, [dimensions, rotX, rotY, heatmapMode, screening])

  useEffect(() => {
    drawMoon()
  }, [drawMoon])

  // Pointer drag interaction handlers (Mouse + Touch)
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    isPointerDownRef.current = true
    hasMovedSignificantlyRef.current = false
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rotX,
      rotY,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return

    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    const distance = Math.hypot(dx, dy)

    if (distance > 5) {
      hasMovedSignificantlyRef.current = true
    }

    if (!hasMovedSignificantlyRef.current) return

    // Drag sensitivity factors
    const sensitivity = 0.0055
    const newRotY = (dragStartRef.current.rotY + dx * sensitivity) % (Math.PI * 2)
    // Constrain pitch to avoid flipping pole upside-down
    const newRotX = Math.max(
      -1.25,
      Math.min(1.25, dragStartRef.current.rotX + dy * sensitivity)
    )

    setRotX(newRotX)
    setRotY(newRotY)
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // Ignore if pointer capture already released
    }

    if (hasMovedSignificantlyRef.current) {
      if (dragSuppressionTimerRef.current) {
        window.clearTimeout(dragSuppressionTimerRef.current)
      }
      dragSuppressionTimerRef.current = window.setTimeout(() => {
        hasMovedSignificantlyRef.current = false
      }, 120)
    }
  }

  const handleResetView = () => {
    setRotX(DEFAULT_ROT_X)
    setRotY(DEFAULT_ROT_Y)
  }

  const handleMarkerClick = (site: Moon3DLandingSite) => {
    if (hasMovedSignificantlyRef.current) {
      return // Ignore accidental click triggered during rotation drag
    }
    setSelection({ kind: 'preset', site })
    setAutoRotate(false)
  }

  // Pre-calculate 3D projected marker coordinates for overlay buttons
  const cx = dimensions.width / 2
  const cy = dimensions.height / 2
  const radius = dimensions.width * 0.44
  const surfaceClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (hasMovedSignificantlyRef.current || (event.target as HTMLElement).closest('button')) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((event.clientX - rect.left) * dimensions.width / rect.width - cx) / radius
    const y = ((event.clientY - rect.top) * dimensions.height / rect.height - cy) / radius
    if (x * x + y * y > 1) return
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y))
    const y1 = y * Math.cos(rotX) + z * Math.sin(rotX)
    const z1 = -y * Math.sin(rotX) + z * Math.cos(rotX)
    const x0 = x * Math.cos(rotY) - z1 * Math.sin(rotY)
    const z0 = x * Math.sin(rotY) + z1 * Math.cos(rotY)
    setSurface({ latitude: Math.asin(Math.max(-1, Math.min(1, -y1))) * 180 / Math.PI, longitude: Math.atan2(x0, z0) * 180 / Math.PI })
    setAutoRotate(false)
  }
  const surfaceProjection = projectPoint(surface.latitude, surface.longitude, rotX, rotY, radius, cx, cy)
  const gridPaths: string[] = []
  for (let lat = -90; lat < 90; lat += 15) for (let lon = -180; lon < 180; lon += 15) {
    const points: string[] = []
    let visible = true
    for (let edge = 0; edge < 4; edge++) for (let step = 0; step <= 5; step++) {
      const t = step / 5
      const a = edge === 0 ? lat : edge === 1 ? lat + 15 * t : edge === 2 ? lat + 15 : lat + 15 * (1 - t)
      const b = edge === 0 ? lon + 15 * t : edge === 1 ? lon + 15 : edge === 2 ? lon + 15 * (1 - t) : lon
      const p = projectPoint(a, b, rotX, rotY, radius, cx, cy)
      if (p.z < 0) visible = false
      points.push(`${p.screenX},${p.screenY}`)
    }
    if (visible) gridPaths.push(points.join(' '))
  }

  const coordinateLines: { key: string; path: string; label: string; x: number; y: number }[] = []
  if (showCoordinateGrid) for (const axis of ['latitude', 'longitude'] as const) {
    const values = axis === 'latitude' ? [-60, -30, 0, 30, 60] : [-180, -120, -60, 0, 60, 120]
    for (const value of values) {
      let path = ''
      let started = false
      const visiblePoints: { screenX: number; screenY: number }[] = []
      const limit = axis === 'latitude' ? 180 : 90
      for (let t = -limit; t <= limit; t += 2) {
        const point = projectPoint(axis === 'latitude' ? value : t, axis === 'latitude' ? t : value, rotX, rotY, radius, cx, cy)
        if (point.z > 0.05) {
          path += `${started ? 'L' : 'M'}${point.screenX},${point.screenY} `
          started = true
          visiblePoints.push(point)
        } else started = false
      }
      const anchor = visiblePoints[Math.floor(visiblePoints.length / 2)]
      if (anchor) coordinateLines.push({ key: `${axis}-${value}`, path, label: `${value}\u00b0 ${axis === 'latitude' ? 'lat' : 'lon'}`, x: anchor.screenX, y: anchor.screenY })
    }
  }

  const projectedSites = MOON3D_LANDING_SITES.map((site) => ({
    site,
    proj: projectPoint(site.latitude, site.longitude, rotX, rotY, radius, cx, cy),
  }))

  const centerLatDeg = (-rotX * 180) / Math.PI
  const centerLonDeg = (-rotY * 180) / Math.PI
  const formatCoord = (deg: number, pos: string, neg: string) => {
    const norm = ((((deg + 180) % 360) + 360) % 360) - 180
    return `${Math.abs(norm).toFixed(1)}Â°${norm >= 0 ? pos : neg}`
  }

  const headingId = useId()

  return (
    <section className="moon3d-panel" aria-labelledby={headingId}>
      {/* Component Header */}
      <div className="moon3d-header">
        <div className="moon3d-title-group">
          <div className="moon3d-eyebrow">
            <span className="moon3d-eyebrow-line" />
            <span>LUNAR RECONNAISSANCE / 3D ORTHOGRAPHIC</span>
          </div>
          <h2 id={headingId}>
            <Orbit size={20} />
            3D Lunar Visualization
          </h2>
          <p>
            Interactive selenographic sphere with procedural surface detail, selectable locations,
            and clearly separated preset demo layers.
          </p>
        </div>

        <div className="moon3d-header-badges">
          <span className="moon3d-badge accent">
            <Orbit size={13} />
            3D SPHERICAL PROJECTION
          </span>
          <span className="moon3d-badge">
            <Info size={12} />
            ILLUSTRATIVE DEMO
          </span>
        </div>
      </div>

      {/* Heatmap Mode Selector Bar */}
      <div className="screening-legend">
        <strong>Illustrative/demo only Â· Combined classification unavailable</strong>
        <p>Real/model-derived: point data in selected-location details. Planned: validated spatial suitability. Mock: preset-node layers and fixture details only.</p>
        <div className="screening-symbols"><span className="screen-pass">âœ“ GREEN Â· all configured requirements pass with margin</span><span className="screen-review">! ORANGE Â· near threshold / non-critical issue</span><span className="screen-fail">âœ• RED Â· mandatory requirement failed</span><span className="screen-unknown">? GREY Â· missing / insufficient data (all current zones)</span></div>
        <p>Legend definitions are planned evaluation rules. No current zone has the required validated data; all remain ?. Boundaries show geographic display cells, not a calculated heatmap.</p>
        <label><input type="checkbox" checked={showCoordinateGrid} onChange={(event) => setShowCoordinateGrid(event.target.checked)} /> Show coordinate grid</label>
        <p>Optional coordinate grid: solid labeled latitude/longitude lines. Screening-cell boundaries: dashed, shown only in Landing Feasibility mode.</p>
        <p>Click any visible surface point to inspect it; drag to rotate. Coordinate selection is also available below. Colored nodes represent fixed preset fixtures only; no whole-surface heatmap is inferred.</p>
        <div className="screening-coordinate-controls">
          <label>Selected latitude (Â°)<input type="number" min="-90" max="90" step="any" value={surface.latitude} onChange={(e) => { const n = e.target.valueAsNumber; if (Number.isFinite(n) && Math.abs(n) <= 90) { setSurface({ ...surface, latitude: n }); setAutoRotate(false) } }} /></label>
          <label>Selected east longitude (Â°)<input type="number" min="-180" max="180" step="any" value={surface.longitude} onChange={(e) => { const n = e.target.valueAsNumber; if (Number.isFinite(n) && Math.abs(n) <= 180) { setSurface({ ...surface, longitude: n }); setAutoRotate(false) } }} /></label>
        </div>
      </div>
      <div className="moon3d-mode-bar" role="toolbar" aria-label="Heatmap overlay modes">
        <span className="moon3d-mode-label">
          <Layers size={13} />
          Layer Mode:
        </span>
        <div className="moon3d-mode-pills">
          <button
            type="button"
            className={`moon3d-mode-button ${heatmapMode === 'none' ? 'active' : ''}`}
            onClick={() => setHeatmapMode('none')}
            aria-pressed={heatmapMode === 'none'}
          >
            Natural Regolith
          </button>
          <button
            type="button"
            className={`moon3d-mode-button ${heatmapMode === 'sunlight' ? 'active' : ''}`}
            onClick={() => setHeatmapMode('sunlight')}
            aria-pressed={heatmapMode === 'sunlight'}
          >
            <Sun size={13} />
            Sunlight Availability
          </button>
          <button
            type="button"
            className={`moon3d-mode-button ${heatmapMode === 'earth-visibility' ? 'active' : ''}`}
            onClick={() => setHeatmapMode('earth-visibility')}
            aria-pressed={heatmapMode === 'earth-visibility'}
          >
            <Radio size={13} />
            Earth Direct Line-of-Sight
          </button>
          <button
            type="button"
            className={`moon3d-mode-button ${heatmapMode === 'feasibility' ? 'active' : ''}`}
            onClick={() => setHeatmapMode('feasibility')}
            aria-pressed={heatmapMode === 'feasibility'}
          >
            <ShieldCheck size={13} />
            Landing Feasibility
          </button>
        </div>
      </div>

      {/* Main Content Grid: Viewport Stage + Inspector Sidebar */}
      <div className="moon3d-grid">
        {/* 3D Viewport Stage */}
        <div className="moon3d-stage" ref={stageRef}>
          <div className="moon3d-stage-bg" />

          {/* Interactive Canvas Container with Pointer Drag */}
          <div
            className="moon3d-canvas-container"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={surfaceClick}
            role="region"
            aria-label="Interactive 3D Moon sphere. Drag with mouse or finger to rotate."
          >
            <canvas ref={canvasRef} className="moon3d-canvas" style={heatmapMode === 'none' ? { filter: 'grayscale(1)' } : undefined} />
            <svg className="screening-grid" width={dimensions.width} height={dimensions.height} aria-hidden="true">
              {screening && <><circle cx={cx} cy={cy} r={radius} fill="#8899aa" fillOpacity=".65" />
                {gridPaths.map((points, i) => <polygon key={i} points={points} fill="none" stroke="#dee6ee" strokeOpacity=".65" strokeDasharray="3 2" />)}
</>}
              {showCoordinateGrid && coordinateLines.map(({ key, path, label, x, y }) => <g key={key}>
                <path d={path} fill="none" stroke="#b9c2cb" strokeWidth="1" />
                <text x={x} y={y} fill="#e1f6ff" stroke="#07121d" strokeWidth="2" paintOrder="stroke" fontSize="10">{label}</text>
              </g>)}
              {surfaceProjection.visible && <g><circle cx={surfaceProjection.screenX} cy={surfaceProjection.screenY} r="7" fill="#0c2134" stroke="white" strokeWidth="2" /><text x={surfaceProjection.screenX + 10} y={surfaceProjection.screenY} fill="white">{selectedSite ? 'Demo preset' : 'Selected ?'}</text></g>}
            </svg>

            {/* Accessible Landing Site Markers Layer */}
            <div className="moon3d-markers-layer">
              {projectedSites.map(({ site, proj }) => {
                if (!proj.visible) return null
                const isSelected = selection.kind === 'preset' && selection.site.id === site.id
                return (
                  <button
                    key={site.id}
                    type="button"
                    className={`moon3d-marker-btn layer-${heatmapMode} ${isSelected ? 'selected' : ''}`}
                    style={{
                      left: `${proj.screenX}px`,
                      top: `${proj.screenY}px`,
                      transform: `translate(-50%, -50%)`,
                      opacity: Math.max(0.75, proj.opacity),
                    }}
                    onPointerDown={(event) => { event.stopPropagation(); hasMovedSignificantlyRef.current = false; dragStartRef.current.x = event.clientX; dragStartRef.current.y = event.clientY }}
                    onPointerMove={(event) => { event.stopPropagation(); if (event.buttons && Math.hypot(event.clientX - dragStartRef.current.x, event.clientY - dragStartRef.current.y) > 5) hasMovedSignificantlyRef.current = true }}
                    onPointerUp={(event) => event.stopPropagation()}
                    onClick={(event) => { event.stopPropagation(); handleMarkerClick(site) }}
                    aria-label={`Select landing site ${site.name}. Region: ${site.region}. Coordinates: ${site.latitude}Â°, ${site.longitude}Â°.`}
                    aria-pressed={isSelected}
                  >
                    <div className="moon3d-pin-target">
                      <div className="moon3d-pin-pulse" />
                    </div>
                    {heatmapMode !== 'none' && <span className="moon3d-node-value">{heatmapMode === 'sunlight' ? `${site.sunlightPct}% demo` : heatmapMode === 'earth-visibility' ? `${site.earthVisibilityPct}% demo` : 'Demo fixture'}</span>}
                    <span className="moon3d-marker-tag">
                      {site.name} ({site.latitude.toFixed(1)}Â°, {site.longitude.toFixed(1)}Â°)
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Viewport HUD Overlays */}
          <div className="moon3d-stage-hud">
            <div className="moon3d-hud-top">
              <div className="moon3d-hud-coords">
                <span>SUB-OBSERVER POINT</span>
                <strong>
                  {formatCoord(centerLatDeg, 'N', 'S')} / {formatCoord(centerLonDeg, 'E', 'W')}
                </strong>
              </div>

              <div className="moon3d-hud-actions">
                <button
                  type="button"
                  className={`moon3d-hud-btn ${autoRotate ? 'active' : ''}`}
                  onClick={() => setAutoRotate((prev) => !prev)}
                  title={autoRotate ? 'Pause auto-rotation' : 'Resume auto-rotation'}
                  aria-label={autoRotate ? 'Pause auto-rotation' : 'Resume auto-rotation'}
                >
                  {autoRotate ? <Pause size={13} /> : <Play size={13} />}
                  <span>{autoRotate ? 'AUTOSPIN ON' : 'SPIN PAUSED'}</span>
                </button>
                <button
                  type="button"
                  className="moon3d-hud-btn"
                  onClick={handleResetView}
                  title="Reset view to initial lunar orientation"
                  aria-label="Reset view to initial orientation"
                >
                  <RotateCcw size={13} />
                  <span>RESET VIEW</span>
                </button>
              </div>
            </div>

            <div className="moon3d-hud-bottom">
              <span className="moon3d-drag-hint">
                <Compass size={12} />
                DRAG SPHERE TO ROTATE
              </span>
              <span>1737.4 KM VOLUMETRIC RADIUS (SCALE)</span>
            </div>
          </div>
        </div>

        {/* Sidebar: Selected Site Inspector + Heatmap Legend */}
        <div className="moon3d-sidebar">
          <div className="moon3d-inspector" aria-live="polite">
  <h3>{activeHeatmap.label}</h3>
  <p className="moon3d-site-desc">Selected location: {surface.latitude.toFixed(4)}&deg; latitude / {surface.longitude.toFixed(4)}&deg; east longitude.</p>
  <p className="moon3d-site-desc">{activeHeatmap.description}</p>
  <p className="moon3d-site-desc">{activeHeatmap.disclaimer}</p>

  <p className="moon3d-site-desc">
  {coverageStatus}
</p>

{site04Coverage?.detail && (
  <p className="moon3d-site-desc">
    {site04Coverage.detail}
  </p>
)}

{site04Coverage?.summary?.coverage_percentage != null && (
  <p className="moon3d-site-desc">
    Coverage: {site04Coverage.summary.coverage_percentage.toFixed(2)}%
  </p>
)}

  <strong>Screening result: ? Grey / Unknown</strong>
</div>


          <div className="moon3d-inspector" aria-live="polite">
            <h3>{selectedSite ? selectedSite.name : 'Selected surface location'}</h3>
            <strong>{selectedSite ? 'Demo preset · not calculated.' : 'Unknown · not enough data to determine.'}</strong>
            <p>{surface.latitude.toFixed(4)}&deg; latitude / {surface.longitude.toFixed(4)}&deg; east longitude</p>
            <h4>{activeHeatmap.label}</h4>
            <p>{selectedSite && (heatmapMode === 'sunlight' || heatmapMode === 'earth-visibility') ? 'Demo layer · preset sites only.' : heatmapMode === 'none' ? 'Neutral procedural terrain · illustrative.' : 'No data for this layer.'}</p>
            <p>{activeHeatmap.disclaimer}</p>
            {selectedSite && <details open><summary>Illustrative demo values · fixed fixture</summary>
              <p>Source: moon3dMockData.ts. These fixed values are separate from provider results and are never evaluated as screening data.</p>
              <dl className="moon3d-fixture-values">
                <dt>Sunlight</dt><dd>{selectedSite.sunlightPct}%</dd>
                <dt>Earth visibility</dt><dd>{selectedSite.earthVisibilityPct}% (demo only)</dd>
                <dt>Elevation</dt><dd>{selectedSite.elevationKm} km (demo only)</dd>
                <dt>Preset comparison score</dt><dd>{selectedSite.feasibilityScore}/100 (demo only)</dd>
              </dl>
            </details>}
            <p>Surface screening remains unknown: no validated site-scale slope, terrain horizons, or configured thresholds. No justified recommendation.</p>
          </div>

          {/* Interactive Heatmap Legend */}
          <div className="moon3d-legend-card" aria-label="Heatmap legend">
            <div className="moon3d-legend-head">
              <h4>
                {heatmapMode === 'sunlight' && <Sun size={15} />}
                {heatmapMode === 'earth-visibility' && <Radio size={15} />}
                {heatmapMode === 'feasibility' && <ShieldCheck size={15} />}
                {heatmapMode === 'none' && <Layers size={15} />}
                {activeHeatmap.label}
              </h4>
              <span className="moon3d-legend-code">{activeHeatmap.shortCode}</span>
            </div>

            <p className="moon3d-legend-desc">{activeHeatmap.description}</p>

            <div className="moon3d-legend-stops">
              {activeHeatmap.stops.map((stop) => (
                <div key={stop.label} className="moon3d-legend-item">
                  <span
                    className="moon3d-legend-swatch"
                    style={{ backgroundColor: stop.color }}
                  />
                  <div className="moon3d-legend-text">
                    <strong>{stop.label}</strong>
                    <span>{stop.description}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="moon3d-disclaimer-banner">
              <AlertTriangle size={15} />
              <div>
                <strong>Scientific Honesty Note:</strong>
                {activeHeatmap.disclaimer}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Module Disclaimer */}
      <h3>Selected-coordinate provider context · separate from demo fixtures</h3>
      <ScreeningDetails key={`${surface.latitude},${surface.longitude},${date}`} location={surface} date={date} />
      <div className="moon3d-disclaimer-banner">
        <CheckCircle2 size={16} />
        <div>
          <strong>Demo Notice:</strong>
          {MOON3D_DISCLAIMER}
        </div>
      </div>
    </section>
  )
}
