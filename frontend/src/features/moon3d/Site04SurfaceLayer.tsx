import { site04ToGeographic, type Site04Terrain, type Site04Footprint } from '../../services/site04Terrain'

export function Site04FootprintLayer({footprint,project,showLocator=true}:{footprint:Site04Footprint|null;showLocator?:boolean;project:(lat:number,lon:number)=>{screenX:number;screenY:number;z:number}}){
  if(!footprint)return null
  const boundary=footprint.boundary.map(point=>project(point.latitude,point.longitude))
  const center=project(footprint.center.latitude,footprint.center.longitude)
  if(center.z<=0)return null
  return <g data-site04-footprint="true">
    {boundary.every(point=>point.z>0) && <polygon points={boundary.map(point=>`${point.screenX},${point.screenY}`).join(' ')} fill="none" stroke="#5ee8ff" strokeWidth="1.5" strokeDasharray="3 2" />}
    {showLocator && <circle cx={center.screenX} cy={center.screenY} r="5" fill="#092b38" stroke="#5ee8ff" strokeWidth="2" />}
    <text x={center.screenX+9} y={center.screenY-10} fill="#9cf1ff" stroke="#07121d" strokeWidth="3" paintOrder="stroke" fontSize="11">{showLocator?'Site04 · locator, not data extent':'Site04 centre · tiny filled square is queried data'}</text>
  </g>
}

export function Site04SurfaceLayer({ data, project }: { data: Site04Terrain | null; project: (lat: number, lon: number) => {screenX:number;screenY:number;z:number} }) {
  if (!data?.cells.length) return null
  const values=data.cells.flatMap(cell=>cell.elevation.status==='available' && cell.elevation.value!==null ? [cell.elevation.value] : [])
  const low=Math.min(...values), high=Math.max(...values)
  return <g data-site04-real-layer="elevation">
    {data.cells.map(cell => {
      const b=cell.bounds
      const points=[[b.min_x,b.min_y],[b.max_x,b.min_y],[b.max_x,b.max_y],[b.min_x,b.max_y]].map(([x,y])=>{const p=site04ToGeographic(x,y);return project(p.latitude,p.longitude)})
      if (points.some(p=>p.z<=0)) return null
      const valid=cell.elevation.status==='available' && cell.elevation.value!==null
      const fraction=valid && high>low ? (cell.elevation.value!-low)/(high-low) : .5
      return <polygon key={`${cell.row}:${cell.column}`} points={points.map(p=>`${p.screenX},${p.screenY}`).join(' ')} fill={valid ? `hsl(195 55% ${25+fraction*50}%)` : '#808690'} stroke="#102532" strokeWidth=".2"><title>{valid ? `${cell.elevation.value!.toFixed(3)} m (NASA surface model)` : 'Missing or unverified elevation'}</title></polygon>
    })}
  </g>
}
