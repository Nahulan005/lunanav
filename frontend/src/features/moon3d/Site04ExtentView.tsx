import { useState } from 'react'
import { site04ToGeographic, type GeographicPoint, type Site04Footprint, type Site04Terrain } from '../../services/site04Terrain'
import './site04Extent.css'

export function Site04ExtentView({footprint,data,onSelect,onOpenTerrain}:{footprint:Site04Footprint|null;data:Site04Terrain|null;onSelect:(point:GeographicPoint)=>void;onOpenTerrain:()=>void}) {
  const [x,setX]=useState(''),[y,setY]=useState('')
  if(!footprint)return <section className="site04-extent-view"><p>Source extent unavailable.</p></section>
  const b=footprint.projected_bounds, window=data?.returned_bounds
  const projectX=(value:number)=>60+(value-b.min_x)/(b.max_x-b.min_x)*320
  const projectY=(value:number)=>40+(b.max_y-value)/(b.max_y-b.min_y)*320
  const width=window ? window.max_x-window.min_x : null, height=window ? window.max_y-window.min_y : null
  const valid=Number.isFinite(Number(x))&&Number.isFinite(Number(y))&&x.trim()!==''&&y.trim()!==''&&Number(x)>=b.min_x&&Number(x)<b.max_x&&Number(y)<=b.max_y&&Number(y)>b.min_y
  return <section className="site04-extent-view" aria-label="Site04 dataset extent and requested window">
    <h3>Site04 data extent · coverage diagram</h3>
    <p>The outer cyan box is the <strong>{(b.max_x-b.min_x)/1000} × {(b.max_y-b.min_y)/1000} km source raster</strong> around Site04. It is a data boundary, not a landing zone or risk assessment. This diagram shows extent, not a terrain image.</p>
    <svg viewBox="0 0 420 415" role="img" aria-label="Projected X/Y source extent with requested window drawn at its actual relative size" onClick={event=>{
      const rect=event.currentTarget.getBoundingClientRect()
      const sx=(event.clientX-rect.left)/rect.width*420, sy=(event.clientY-rect.top)/rect.height*415
      if(sx<60||sx>=380||sy<40||sy>=360)return
      onSelect(site04ToGeographic(b.min_x+(sx-60)/320*(b.max_x-b.min_x),b.max_y-(sy-40)/320*(b.max_y-b.min_y)))
    }}>
      <rect x="60" y="40" width="320" height="320" fill="#303c47" stroke="#61dff5" strokeWidth="2" strokeDasharray="5 3" />
      {[0,.25,.5,.75,1].map(t=><g key={t} fill="#b6cbd8" fontSize="10"><path d={`M ${60+t*320} 40 V 360 M 60 ${40+t*320} H 380`} stroke="#8194a4" strokeOpacity=".2" /><text x={60+t*320} y="379" textAnchor="middle">{(b.min_x+t*(b.max_x-b.min_x))/1000}</text><text x="50" y={44+t*320} textAnchor="end">{(b.max_y-t*(b.max_y-b.min_y))/1000}</text></g>)}
      <text x="220" y="23" textAnchor="middle" fill="#a6efff" fontSize="12">Source footprint · not measured coverage in every pixel</text>
      <text x="220" y="404" textAnchor="middle" fill="#c5dbe8" fontSize="12">X / easting (km)</text>
      <text x="13" y="200" transform="rotate(-90 13 200)" textAnchor="middle" fill="#c5dbe8" fontSize="12">Y / northing (km)</text>
      {window && <rect data-site04-query-window="true" x={projectX(window.min_x)} y={projectY(window.max_y)} width={width!/(b.max_x-b.min_x)*320} height={height!/(b.max_y-b.min_y)*320} fill="#7aeaff" stroke="#f5d17b" strokeWidth="1" />}
    </svg>
    <div className="site04-extent-legend"><p><span className="extent-outline" />Cyan dashed outline: entire source extent.</p><p><span className="extent-query" />Small filled square: {width!==null ? `${width} × ${height} m currently requested` : 'no window loaded'}.</p><p><span className="extent-unqueried" />Grey: no elevation values displayed in this diagram.</p></div>
    <p>Click inside the box to request a different small patch. The square stays at its true relative size; <strong>open 3D terrain</strong> to inspect that patch's shape.</p>
    <form onSubmit={event=>{event.preventDefault();if(valid)onSelect(site04ToGeographic(Number(x),Number(y)))}}><label>X (m)<input type="number" value={x} placeholder="Easting" onChange={event=>setX(event.target.value)} /></label><label>Y (m)<input type="number" value={y} placeholder="Northing" onChange={event=>setY(event.target.value)} /></label><button type="submit" disabled={!valid}>Load patch</button></form>
    <button type="button" onClick={onOpenTerrain} disabled={!data?.cells.length}>Open this patch in 3D terrain</button>
    <p>{footprint.frame}. Geographic placement remains provisional.</p>
  </section>
}
