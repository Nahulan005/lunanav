import type { Site04Cell } from '../../services/site04Terrain'

/** Authored geometry fixture. Local display coordinates only, no lunar location.
 * Never passed to an API, provider result, coverage layer or suitability model.
 */
export const DEMO_TERRAINS = [
  {id:'crater-peak',name:'Crater and peak'},
  {id:'twin-craters',name:'Twin crater bowls'},
  {id:'ridge-valley',name:'Ridge and valley'},
  {id:'central-massif',name:'Central peak massif'},
  {id:'broken-rim',name:'Broken crater rim'},
] as const
export type DemoTerrainId = typeof DEMO_TERRAINS[number]['id']

export function makeIllustrativeTerrain(preset: DemoTerrainId = 'crater-peak'): Site04Cell[] {
  const cells:Site04Cell[]=[]
  for(let row=0;row<32;row++)for(let column=0;column<32;column++){
    const x=(column-15.5)/15.5,y=(row-15.5)/15.5
    const crater=Math.hypot(x+.38,y+.18)
    const peak=43*Math.exp(-((x-.38)**2+(y-.30)**2)/.065)
    const bowl=-23*Math.exp(-(crater**2)/.035)
    const rim=9*Math.exp(-((crater-.30)**2)/.003)
    const ridge=13*Math.exp(-((y+.6+.12*Math.sin(x*4))**2)/.022)
    const gaussian=(cx:number,cy:number,width:number)=>Math.exp(-((x-cx)**2+(y-cy)**2)/width)
    const ring=(cx:number,cy:number,radius:number)=>Math.exp(-((Math.hypot(x-cx,y-cy)-radius)**2)/.006)
    const noise=1.8*Math.sin(x*7)*Math.cos(y*6)
    const height=preset==='twin-craters' ? -29*gaussian(-.38,-.25,.055)-22*gaussian(.40,.28,.04)+12*ring(-.38,-.25,.34)+9*ring(.40,.28,.28)+noise
      : preset==='ridge-valley' ? 29*Math.exp(-((x+.28+.15*Math.sin(y*4))**2)/.04)-21*Math.exp(-((x-.28)**2)/.055)+8*y+noise
      : preset==='central-massif' ? 51*gaussian(0,0,.14)+24*gaussian(.48,-.36,.05)+18*gaussian(-.45,.38,.045)-7+noise
      : preset==='broken-rim' ? -27*gaussian(0,0,.16)+21*ring(0,0,.53)*(1-.9*gaussian(.48,.12,.06))+11*gaussian(-.62,-.5,.08)+noise
      : peak+bowl+rim+ridge+noise
    const absent={value:null,unit:'degree' as const,status:'unverified' as const}
    cells.push({row,column,bounds:{min_x:column*5,min_y:-(row+1)*5,max_x:(column+1)*5,max_y:-row*5},center:null,
      elevation:{value:height,unit:'m',status:'available'},slope:absent,slope_rms_uncertainty:absent,
      elevation_rms_uncertainty:{value:null,unit:'m',status:'unverified'},observation_status:'unverified'})
  }
  return cells
}
