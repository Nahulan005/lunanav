import { useEffect, useRef } from 'react'
import earth from '../assets/orbital-earth.jpg'

/** Decorative composition. Historical Earth photo is not current provider data. */
export function OrbitalBackdrop() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const draw = () => {
      const context = element.getContext('2d')
      if (!context) return
      const width = window.innerWidth, height = window.innerHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      element.width = width * ratio; element.height = height * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      let seed = 261119
      const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
      // Broad, quiet dust lanes give depth without competing with labels.
      for (let i = 0; i < 12; i++) {
        const x = width * (i / 11), y = height * (.16 + .42 * (i / 11))
        context.save(); context.translate(x, y); context.rotate(.4); context.scale(1, .25)
        const dust = context.createRadialGradient(0, 0, 0, 0, 0, width * .28)
        dust.addColorStop(0, i % 2 ? '#637f9a0b' : '#665f940b'); dust.addColorStop(1, 'transparent')
        context.fillStyle = dust; context.fillRect(-width, -height * 4, width * 2, height * 8); context.restore()
      }
      const count = Math.min(2600, Math.max(650, Math.round(width * height / 700)))
      for (let i = 0; i < count; i++) {
        const x = random() * width, y = random() * height, brightness = random()
        const radius = brightness > .992 ? 1.65 : brightness > .94 ? 1 : .25 + random() * .55
        const color = i % 9 === 0 ? '255,221,187' : i % 3 === 0 ? '177,205,255' : '220,233,244'
        if (brightness > .975) {
          const halo = context.createRadialGradient(x, y, 0, x, y, radius * 8)
          halo.addColorStop(0, `rgba(${color},.24)`); halo.addColorStop(1, `rgba(${color},0)`)
          context.fillStyle = halo; context.fillRect(x - radius * 8, y - radius * 8, radius * 16, radius * 16)
        }
        context.fillStyle = `rgba(${color},${.18 + brightness * .7})`
        context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill()
        if (brightness > .997) {
          context.strokeStyle = `rgba(${color},.25)`; context.lineWidth = .5
          context.beginPath(); context.moveTo(x - 5, y); context.lineTo(x + 5, y); context.moveTo(x, y - 5); context.lineTo(x, y + 5); context.stroke()
        }
      }
    }
    draw(); window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])
  return <div className="orbital-backdrop" aria-hidden="true">
    <canvas ref={canvas} className="orbital-starfield" />
    <div className="scene-earth"><img className="earth-photo" src={earth} alt="" draggable={false} /><span className="earth-light" /></div>
    <div className="scene-sun"><span /></div>
    <div className="solar-scatter" />
  </div>
}
