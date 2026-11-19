import type { Site04Cell } from '../../services/site04Terrain'

/** Mesh vertices are native cell centres; no extrapolation beyond centres.
 * Each triangle uses adjacent valid samples only. Heights are relative to the
 * midrange solely to keep the camera near the origin; raw values stay intact.
 */
export function buildSite04Mesh(cells: Site04Cell[]) {
  const valid=cells.filter(cell=>cell.elevation.status==='available' && cell.elevation.value!==null && Number.isFinite(cell.elevation.value))
  if (!valid.length) return null
  const low=Math.min(...valid.map(c=>c.elevation.value!)), high=Math.max(...valid.map(c=>c.elevation.value!))
  const minX=Math.min(...valid.map(c=>(c.bounds.min_x+c.bounds.max_x)/2))
  const maxX=Math.max(...valid.map(c=>(c.bounds.min_x+c.bounds.max_x)/2))
  const minY=Math.min(...valid.map(c=>(c.bounds.min_y+c.bounds.max_y)/2))
  const maxY=Math.max(...valid.map(c=>(c.bounds.min_y+c.bounds.max_y)/2))
  const origin={x:(minX+maxX)/2,y:(minY+maxY)/2,z:(low+high)/2}
  const positions:number[]=[],colors:number[]=[],indices:number[]=[]
  const lookup=new Map<string,number>()
  valid.forEach((cell,index)=>{
    positions.push((cell.bounds.min_x+cell.bounds.max_x)/2-origin.x,cell.elevation.value!-origin.z,-((cell.bounds.min_y+cell.bounds.max_y)/2-origin.y))
    const t=high===low ? .5 : (cell.elevation.value!-low)/(high-low)
    colors.push(.12+.42*t,.30+.49*t,.38+.46*t)
    lookup.set(`${cell.row}:${cell.column}`,index)
  })
  for (const cell of valid) {
    const a=lookup.get(`${cell.row}:${cell.column}`), b=lookup.get(`${cell.row}:${cell.column+1}`)
    const c=lookup.get(`${cell.row+1}:${cell.column}`), d=lookup.get(`${cell.row+1}:${cell.column+1}`)
    // Require all four neighbours: missing cells leave a hole, never a bridge.
    if (a!==undefined && b!==undefined && c!==undefined && d!==undefined) indices.push(a,c,b,b,c,d)
  }
  return {positions,colors,indices,cells:valid,origin,low,high,span:Math.max(maxX-minX,maxY-minY,high-low,5)}
}
