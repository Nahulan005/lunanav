import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { BufferGeometry, Float32BufferAttribute, DoubleSide } from 'three'
import type { Site04Cell, Site04Terrain } from '../../services/site04Terrain'
import { buildSite04Mesh } from './site04Mesh'
import { makeIllustrativeTerrain, DEMO_TERRAINS, type DemoTerrainId } from './illustrativeTerrain'
import './site04TerrainScene.css'

class TerrainBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed ? <p role="alert">3D terrain renderer unavailable. Inspect real values in Data &amp; Coverage; no substitute terrain is shown.</p> : this.props.children}
}

export default function Site04TerrainScene({data,status,onSelect,onWholeMoon,illustrative=false}:{data:Site04Terrain|null;status:string;onSelect:(cell:Site04Cell)=>void;onWholeMoon:()=>void;illustrative?:boolean}) {
  const [demoPreset,setDemoPreset]=useState<DemoTerrainId>('crater-peak')
  const model=useMemo(()=>buildSite04Mesh(illustrative ? makeIllustrativeTerrain(demoPreset) : data?.cells ?? []),[data,illustrative,demoPreset])
  const [reset,setReset]=useState(0)
  const [wireframe,setWireframe]=useState(false)
  const [verticalExaggeration,setVerticalExaggeration]=useState<1|2|4>(1)
  const [sampleIndex,setSampleIndex]=useState('')
  const [colorLayer,setColorLayer]=useState<'elevation'|'slope'>('elevation')
  useEffect(()=>setSampleIndex(''),[data,illustrative,demoPreset])
  useEffect(()=>{if(illustrative && model?.cells.length)onSelect(model.cells[0])},[model,illustrative,onSelect])
  const geometry=useMemo(()=>{
    if (!model) return null
    const result=new BufferGeometry()
    result.setAttribute('position',new Float32BufferAttribute(model.positions,3))
    const metricValues=model.cells.map(cell=>cell[colorLayer]).filter(metric=>metric.status==='available'&&metric.value!==null).map(metric=>metric.value!)
    const low=Math.min(...metricValues),high=Math.max(...metricValues)
    const stops=colorLayer==='slope'?[[.12,.35,.58],[.92,.66,.25],[.83,.23,.16]]:[[.12,.28,.40],[.22,.62,.72],[.90,.86,.68]]
    const colors=model.cells.flatMap(cell=>{
      const metric=cell[colorLayer]
      if(metric.status!=='available'||metric.value===null)return [.36,.40,.44]
      const t=high===low ? 0.5 : (metric.value-low)/(high-low),scaled=t*2,index=Math.min(1,Math.floor(scaled)),f=scaled-index
      return stops[index].map((value,axis)=>value+(stops[index+1][axis]-value)*f)
    })
    result.setAttribute('color',new Float32BufferAttribute(colors,3))
    result.setIndex(model.indices);result.computeVertexNormals()
    return result
  },[model,colorLayer])
  useEffect(()=>()=>geometry?.dispose(),[geometry])
  const pick=(event:ThreeEvent<MouseEvent>)=>{
    event.stopPropagation()
    if (!model || !event.face || event.delta>5) return
    const indices=[event.face.a,event.face.b,event.face.c]
    const nearest=indices.reduce((best,index)=>{
      const distance=(i:number)=>Math.hypot(model.positions[i*3]-event.point.x,model.positions[i*3+1]*verticalExaggeration-event.point.y,model.positions[i*3+2]-event.point.z)
      return distance(index)<distance(best)?index:best
    })
    onSelect(model.cells[nearest])
    setSampleIndex(String(nearest))
  }
  const displaySpan=model ? Math.max(model.span,(model.high-model.low)*verticalExaggeration) : 1
  const colorMetrics=model?.cells.map(cell=>cell[colorLayer]).filter(metric=>metric.status==='available'&&metric.value!==null).map(metric=>metric.value!) ?? []
  const colorLow=colorMetrics.length?Math.min(...colorMetrics):null,colorHigh=colorMetrics.length?Math.max(...colorMetrics):null
  const colorRamp=colorLayer==='slope'?'linear-gradient(90deg,#1f5994,#e8a83f,#d43b29)':'linear-gradient(90deg,#1f4966,#379eb8,#e6dbae)'
  return <section className="site04-relief-view" aria-label={illustrative ? 'Illustrative 3D terrain sandbox' : 'Real Site04 3D terrain relief'}>
    <header><h3>{illustrative ? 'Illustrative terrain sandbox · generated geometry' : 'Site04 · 3D terrain relief'}</h3><span role="status">{status}</span></header>
    {illustrative && <p className="site04-demo-warning"><strong>DEMO ONLY:</strong> authored peaks, crater bowl, raised rim and ridge. This is not terrain at the selected Moon location and does not fill missing NASA data. All dimensions and heights here are fictional display values.</p>}
    {illustrative && <label className="site04-relief-sample">Demo landscape <select value={demoPreset} onChange={event=>{setDemoPreset(event.target.value as DemoTerrainId);setReset(value=>value+1)}}>{DEMO_TERRAINS.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><small>Choose one of five fictional models. Changing lunar coordinates does not change a demo fixture.</small></label>}
    {model && <p>Drag to orbit, scroll or pinch to zoom, and click to inspect a sample. Horizontal and vertical metres use the same scale (1×).</p>}
    <div className="site04-relief-controls">{model && <>
      <button type="button" onClick={()=>setReset(value=>value+1)}>Reset terrain camera</button>
      <button type="button" aria-pressed={wireframe} onClick={()=>setWireframe(value=>!value)}>Mesh edges · {wireframe?'ON':'OFF'}</button>
    </>}<button type="button" onClick={onWholeMoon}>Return to whole Moon</button></div>
    {model && <div className="site04-relief-controls">
      {!illustrative && <button type="button" aria-pressed={colorLayer==='slope'} onClick={()=>setColorLayer(value=>value==='elevation'?'slope':'elevation')}>Color by {colorLayer==='elevation'?'slope':'elevation'}</button>}
      {!illustrative && <button type="button" aria-label={`Vertical relief exaggeration ${verticalExaggeration} times; change display scale`} onClick={()=>setVerticalExaggeration(value=>value===1?2:value===2?4:1)}>Vertical relief · {verticalExaggeration}×</button>}
    </div>}
    {model && !illustrative && <div className="site04-elevation-zones"><strong>{colorLayer==='elevation'?'Elevation':'Slope'} colour scale · current patch only</strong><div className="site04-band-legend"><span>Low</span><i style={{background:colorRamp}} /><span>High</span></div><p>{colorLow===null?'No valid values are available for this layer.':`${colorLow.toFixed(2)}–${colorHigh!.toFixed(2)} ${colorLayer==='slope'?'°':'m'} · dark to light.`} Grey marks unavailable samples. Colours stretch to this patch’s data range and do not imply a safety threshold or a good/bad site.</p></div>}
    {model && <label className="site04-relief-sample">Inspect {illustrative?'demo ':''}sample <select value={sampleIndex} onChange={event=>{setSampleIndex(event.target.value);if(event.target.value!=='')onSelect(model.cells[Number(event.target.value)])}}><option value="">{illustrative?'Choose a fictional fixture sample':'Choose a native sample'}</option>{model.cells.map((cell,index)=><option key={`${cell.row}:${cell.column}`} value={index}>Row {cell.row}, column {cell.column} · {cell.elevation.value!.toFixed(3)} {illustrative?'demo ':''}m</option>)}</select></label>}
    {model && geometry && model.indices.length>0 ? <TerrainBoundary><div className="site04-relief-canvas" data-terrain-vertices={model.cells.length} data-terrain-triangles={model.indices.length/3} data-height-range={model.high-model.low}>
      <Canvas key={`${reset}:${model.origin.x}:${model.origin.y}:${verticalExaggeration}`} frameloop="demand" dpr={[1,1.5]} camera={{position:[displaySpan*1.25,displaySpan,displaySpan*1.25],fov:45,near:.1,far:displaySpan*30}} gl={{antialias:true,powerPreference:'low-power'}} fallback={<p>WebGL unavailable. Real values remain in Data &amp; Coverage.</p>}>
        <color attach="background" args={['#18212b']} />
        <ambientLight intensity={.4} />
        <directionalLight position={[-model.span,model.span*2,model.span]} intensity={1.5} />
        <mesh geometry={geometry} scale={[1,verticalExaggeration,1]} onClick={pick}><meshStandardMaterial vertexColors side={DoubleSide} roughness={.95} wireframe={wireframe} /></mesh>
        <OrbitControls makeDefault enableDamping={false} minDistance={displaySpan*.15} maxDistance={displaySpan*8} maxPolarAngle={Math.PI*.49} target={[0,0,0]} />
        <axesHelper args={[model.span*.25]} />
      </Canvas>
    </div></TerrainBoundary> : data?.cells.length ? <p className="site04-relief-empty">A 3D surface requires adjacent valid elevation samples. Use Data &amp; Coverage to inspect individual cells.</p> : null}
    {model && <p>{illustrative?'Demo elevation':'Elevation'} {model.low.toFixed(2)}–{model.high.toFixed(2)} m · measured relief {(model.high-model.low).toFixed(2)} m · {illustrative?'fictional fixture':'native'} spacing 5 m. {illustrative?'Local display axes only.':`X: east; depth: south; vertical display exaggeration ${verticalExaggeration}× (height values remain unchanged).`}</p>}
    {model && !illustrative && <p className="site04-resolution-note">This window is only {model.cells.length} valid native samples within a 160 × 160 m patch. The renderer shows measured elevations; it does not add crater shapes. A crater may not be identifiable at this extent/resolution, and surface appearance alone cannot establish a safe landing spot.</p>}
    {model && <p>{illustrative ? 'Geometry comes from the local illustrativeTerrain.ts fixture; no provider, ephemeris or lunar coordinates are used.' : 'Mesh vertices use actual NASA SURF sample heights. Triangles connect adjacent valid cell centres for display; gaps are not filled. SURF itself includes NASA interpolation.'} Local height origin is {model?.origin.z.toFixed(3) ?? 'unavailable'} m; this display offset does not establish an absolute elevation datum. Lighting is illustrative.</p>}
  </section>
}
