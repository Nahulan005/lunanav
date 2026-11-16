import { Component, useEffect, useMemo, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import { CanvasTexture, SRGBColorSpace } from 'three'

interface Props { rotationX: number; rotationY: number; size: number; onReady: () => void; onUnavailable: () => void }

/** Locally generated decorative albedo/bump texture. Never NASA terrain or elevation. */
function makeRegolith() {
  const canvas = document.createElement('canvas')
  canvas.width = 2048; canvas.height = 1024
  const ctx = canvas.getContext('2d')!
  let seed = 8173
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  const image = ctx.createImageData(canvas.width, canvas.height)
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 139 + random() * 22
    image.data[i] = v; image.data[i+1] = v; image.data[i+2] = v; image.data[i+3] = 255
  }
  ctx.putImageData(image, 0, 0)
  // Broad synthetic maria, softly blended into the regolith.
  for (let i=0;i<18;i++) {
    const x=random()*2048, y=180+random()*650, r=45+random()*190
    const gradient=ctx.createRadialGradient(x,y,0,x,y,r)
    gradient.addColorStop(0,'rgba(52,57,61,.38)'); gradient.addColorStop(1,'rgba(43,47,50,0)')
    ctx.fillStyle=gradient; ctx.fillRect(x-r,y-r,r*2,r*2)
  }
  for(let i=0;i<600;i++) {
    const x=random()*2048,y=random()*1024,r=2+Math.pow(random(),3.5)*35
    const gradient=ctx.createRadialGradient(x-r*.12,y+r*.15,r*.1,x,y,r)
    gradient.addColorStop(0,'rgba(46,50,53,.46)');gradient.addColorStop(.65,'rgba(94,99,102,.30)');gradient.addColorStop(.8,'rgba(218,219,213,.30)');gradient.addColorStop(1,'rgba(170,172,168,0)')
    ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()
  }
  const texture=new CanvasTexture(canvas)
  texture.colorSpace=SRGBColorSpace
  return texture
}
function Surface() {
  const texture=useMemo(makeRegolith,[])
  useEffect(()=>()=>texture.dispose(),[texture])
  return <mesh><sphereGeometry args={[1,128,64]} /><meshStandardMaterial map={texture} bumpMap={texture} bumpScale={0.007} roughness={1} metalness={0} /></mesh>
}
function ContextStatus({onReady,onUnavailable}:Pick<Props,'onReady'|'onUnavailable'>) {
  const gl=useThree(s=>s.gl)
  useEffect(()=>{
    const lost=(event:Event)=>{event.preventDefault();onUnavailable()}
    gl.domElement.addEventListener('webglcontextlost',lost)
    onReady()
    return ()=>gl.domElement.removeEventListener('webglcontextlost',lost)
  },[gl,onReady,onUnavailable])
  return null
}
class SceneBoundary extends Component<{ children: ReactNode; onUnavailable:()=>void },{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(){this.props.onUnavailable()}
  render(){return this.state.failed?null:this.props.children}
}
export default function MoonScene(props:Props) {
  return <SceneBoundary onUnavailable={props.onUnavailable}>
    <Canvas frameloop="demand" dpr={[1,1.5]} gl={{alpha:true,antialias:true,powerPreference:'low-power'}}
      fallback={<span>Canvas unavailable; use the 2D fallback.</span>} style={{pointerEvents:'none'}}>
      <OrthographicCamera makeDefault position={[0,0,5]} zoom={props.size*.44} near={.1} far={20} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[-3,3,4]} intensity={2.3} color="#f5f6f7" />
      <directionalLight position={[3,-1,-2]} intensity={0.25} color="#719bbd" />
      <group rotation={[-props.rotationX,props.rotationY,0]}><Surface /></group>
      <ContextStatus onReady={props.onReady} onUnavailable={props.onUnavailable} />
    </Canvas>
  </SceneBoundary>
}
