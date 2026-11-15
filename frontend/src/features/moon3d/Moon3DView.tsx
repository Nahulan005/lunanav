import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Info,
  Layers,
  MapPin,
  Orbit,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sun,
  X,
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

export function Moon3DView({ initialSelectedId }: { initialSelectedId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const [rotX, setRotX] = useState<number>(DEFAULT_ROT_X)
  const [rotY, setRotY] = useState<number>(DEFAULT_ROT_Y)
  const [autoRotate, setAutoRotate] = useState<boolean>(true)
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('none')
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(
    initialSelectedId ?? 'shackleton'
  )
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 440,
    height: 440,
  })

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

  const selectedSite =
    MOON3D_LANDING_SITES.find((site) => site.id === selectedSiteId) ?? null

  const activeHeatmap = HEATMAP_CONFIGS[heatmapMode]

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

    // 6. Selenographic Graticule (Parallels & Meridians)
    ctx.save()
    ctx.lineWidth = 0.75
    const latLines = [-60, -30, 0, 30, 60]
    for (const lat of latLines) {
      ctx.beginPath()
      let hasStarted = false
      ctx.strokeStyle = lat === 0 ? 'rgba(126, 194, 235, 0.35)' : 'rgba(126, 194, 235, 0.18)'
      for (let lon = -180; lon <= 180; lon += 6) {
        const pt = projectPoint(lat, lon, rotX, rotY, radius, cx, cy)
        if (pt.z > 0.03) {
          if (!hasStarted) {
            ctx.moveTo(pt.screenX, pt.screenY)
            hasStarted = true
          } else {
            ctx.lineTo(pt.screenX, pt.screenY)
          }
        } else {
          hasStarted = false
        }
      }
      ctx.stroke()
    }

    const lonLines = [-120, -60, 0, 60, 120]
    for (const lon of lonLines) {
      ctx.beginPath()
      let hasStarted = false
      ctx.strokeStyle = lon === 0 ? 'rgba(126, 194, 235, 0.35)' : 'rgba(126, 194, 235, 0.18)'
      for (let lat = -90; lat <= 90; lat += 4) {
        const pt = projectPoint(lat, lon, rotX, rotY, radius, cx, cy)
        if (pt.z > 0.03) {
          if (!hasStarted) {
            ctx.moveTo(pt.screenX, pt.screenY)
            hasStarted = true
          } else {
            ctx.lineTo(pt.screenX, pt.screenY)
          }
        } else {
          hasStarted = false
        }
      }
      ctx.stroke()
    }
    ctx.restore()

    // 7. Illustrative Heatmap Overlay (if active)
    if (heatmapMode !== 'none') {
      ctx.save()
      ctx.globalAlpha = 0.52

      if (heatmapMode === 'sunlight') {
        // Solar Illumination Heatmap: amber illumination gradient across the sphere
        const sunGrad = ctx.createRadialGradient(
          cx + sunX * radius * 0.7,
          cy + sunY * radius * 0.7,
          radius * 0.05,
          cx,
          cy,
          radius * 1.1
        )
        sunGrad.addColorStop(0, 'rgba(255, 215, 115, 0.85)')
        sunGrad.addColorStop(0.35, 'rgba(240, 193, 106, 0.65)')
        sunGrad.addColorStop(0.7, 'rgba(175, 120, 45, 0.45)')
        sunGrad.addColorStop(1, 'rgba(30, 40, 65, 0.85)')

        ctx.fillStyle = sunGrad
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
      } else if (heatmapMode === 'earth-visibility') {
        // Earth Line-of-Sight: centered at selenographic (0° Lat, 0° Lon) Sub-Earth point
        const subEarth = projectPoint(0, 0, rotX, rotY, radius, cx, cy)
        if (subEarth.z > -0.3) {
          const earthGrad = ctx.createRadialGradient(
            subEarth.screenX,
            subEarth.screenY,
            radius * 0.08,
            subEarth.screenX,
            subEarth.screenY,
            radius * 1.3
          )
          earthGrad.addColorStop(0, 'rgba(90, 201, 237, 0.85)')
          earthGrad.addColorStop(0.4, 'rgba(56, 142, 195, 0.6)')
          earthGrad.addColorStop(0.75, 'rgba(25, 60, 95, 0.35)')
          earthGrad.addColorStop(1, 'rgba(10, 20, 35, 0.85)')

          ctx.fillStyle = earthGrad
          ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
        } else {
          // Sub-Earth is on far side: render deep occultation shadow
          ctx.fillStyle = 'rgba(15, 25, 42, 0.88)'
          ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
        }
      } else if (heatmapMode === 'feasibility') {
        // Mission Feasibility Index: Multi-zone terrain composite
        const feasGrad = ctx.createRadialGradient(
          cx - radius * 0.2,
          cy - radius * 0.15,
          radius * 0.1,
          cx,
          cy,
          radius
        )
        feasGrad.addColorStop(0, 'rgba(112, 227, 176, 0.75)')
        feasGrad.addColorStop(0.45, 'rgba(240, 193, 106, 0.55)')
        feasGrad.addColorStop(0.85, 'rgba(248, 135, 149, 0.65)')
        feasGrad.addColorStop(1, 'rgba(25, 35, 50, 0.85)')

        ctx.fillStyle = feasGrad
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
      }

      ctx.restore()
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
  }, [dimensions, rotX, rotY, heatmapMode])

  useEffect(() => {
    drawMoon()
  }, [drawMoon])

  // Pointer drag interaction handlers (Mouse + Touch)
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
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
    setSelectedSiteId((prev) => (prev === site.id ? null : site.id))
  }

  // Pre-calculate 3D projected marker coordinates for overlay buttons
  const cx = dimensions.width / 2
  const cy = dimensions.height / 2
  const radius = dimensions.width * 0.44

  const projectedSites = MOON3D_LANDING_SITES.map((site) => ({
    site,
    proj: projectPoint(site.latitude, site.longitude, rotX, rotY, radius, cx, cy),
  }))

  const centerLatDeg = (-rotX * 180) / Math.PI
  const centerLonDeg = (-rotY * 180) / Math.PI
  const formatCoord = (deg: number, pos: string, neg: string) => {
    const norm = ((((deg + 180) % 360) + 360) % 360) - 180
    return `${Math.abs(norm).toFixed(1)}°${norm >= 0 ? pos : neg}`
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
            Interactive selenographic sphere with 3D terrain relief, landing target tracking,
            and simulated environmental heatmaps.
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
            role="region"
            aria-label="Interactive 3D Moon sphere. Drag with mouse or finger to rotate."
          >
            <canvas ref={canvasRef} className="moon3d-canvas" />

            {/* Accessible Landing Site Markers Layer */}
            <div className="moon3d-markers-layer">
              {projectedSites.map(({ site, proj }) => {
                if (!proj.visible) return null
                const isSelected = selectedSiteId === site.id
                return (
                  <button
                    key={site.id}
                    type="button"
                    className={`moon3d-marker-btn ${isSelected ? 'selected' : ''}`}
                    style={{
                      left: `${proj.screenX}px`,
                      top: `${proj.screenY}px`,
                      transform: `translate(-50%, -50%) scale(${proj.scale})`,
                      opacity: proj.opacity,
                    }}
                    onClick={() => handleMarkerClick(site)}
                    aria-label={`Select landing site ${site.name}. Region: ${site.region}. Coordinates: ${site.latitude}°, ${site.longitude}°.`}
                    aria-pressed={isSelected}
                  >
                    <div className="moon3d-pin-target">
                      <div className="moon3d-pin-pulse" />
                    </div>
                    <span className="moon3d-marker-tag">
                      {site.name} ({site.latitude.toFixed(1)}°, {site.longitude.toFixed(1)}°)
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
          {/* Selected Site Details Card */}
          {selectedSite ? (
            <div className="moon3d-inspector" aria-label={`Site details for ${selectedSite.name}`}>
              <div className="moon3d-inspector-head">
                <div className="moon3d-inspector-title">
                  <span className="moon3d-inspector-region">{selectedSite.region}</span>
                  <h3>{selectedSite.name}</h3>
                </div>
                <button
                  type="button"
                  className="moon3d-close-btn"
                  onClick={() => setSelectedSiteId(null)}
                  aria-label="Deselect site and close details panel"
                  title="Close panel"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="moon3d-historical-pill">
                <MapPin size={13} />
                <span>{selectedSite.historicalContext}</span>
              </div>

              <div className="moon3d-metrics-grid">
                <div className="moon3d-metric-box">
                  <span className="moon3d-metric-code">SOLAR / 01</span>
                  <span className="moon3d-metric-value amber">{selectedSite.sunlightPct}%</span>
                  <span className="moon3d-metric-label">Sunlight Illumination</span>
                </div>
                <div className="moon3d-metric-box">
                  <span className="moon3d-metric-code">COMM / 02</span>
                  <span className="moon3d-metric-value cyan">
                    {selectedSite.earthVisibilityPct}%
                  </span>
                  <span className="moon3d-metric-label">Earth Direct Visibility</span>
                </div>
                <div className="moon3d-metric-box">
                  <span className="moon3d-metric-code">ELEV / 03</span>
                  <span className="moon3d-metric-value">
                    {selectedSite.elevationKm > 0 ? '+' : ''}
                    {selectedSite.elevationKm.toFixed(1)} km
                  </span>
                  <span className="moon3d-metric-label">Surface Elevation</span>
                </div>
                <div className="moon3d-metric-box">
                  <span className="moon3d-metric-code">FEAS / 04</span>
                  <span
                    className={`moon3d-metric-value ${
                      selectedSite.feasibilityScore >= 80 ? 'green' : 'amber'
                    }`}
                  >
                    {selectedSite.feasibilityScore}/100
                  </span>
                  <span className="moon3d-metric-label">Feasibility Index</span>
                </div>
              </div>

              <p className="moon3d-site-desc">{selectedSite.description}</p>
            </div>
          ) : (
            <div className="moon3d-inspector">
              <div className="moon3d-inspector-head">
                <div className="moon3d-inspector-title">
                  <span className="moon3d-inspector-region">TARGET RECONNAISSANCE</span>
                  <h3>No Target Selected</h3>
                </div>
              </div>
              <p className="moon3d-site-desc">
                Select any glowing beacon marker on the lunar surface to inspect coordinates,
                illumination windows, communication line-of-sight, and feasibility scores.
              </p>
            </div>
          )}

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
