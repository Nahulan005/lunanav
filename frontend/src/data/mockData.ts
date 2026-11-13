export interface LandingSite { id: string; name: string; region: string; latitude: number; longitude: number; description: string; position: [number, number] }
export interface AnalysisRequest { siteId: string; latitude: number; longitude: number; landingDate: string }
export interface DemoAnalysis { sunlight: number; visibility: number; obstruction: number; feasibility: number }
export interface Scenario { site: LandingSite; label: string; analysis: DemoAnalysis }
export const landingSites: LandingSite[] = [
  { id: 'shackleton', name: 'Shackleton Rim', region: 'Lunar south pole', latitude: -89.9, longitude: 0, description: 'Explore a south-polar landing concept at the rim of Shackleton Crater. This illustrative scenario prioritizes extended illumination windows.', position: [49, 84] },
  { id: 'apollo17', name: 'Apollo 17 Site', region: 'Taurus–Littrow valley', latitude: 20.19, longitude: 30.77, description: 'Revisit the Taurus–Littrow region with a sample mission scenario inspired by lunar exploration heritage.', position: [68, 35] },
  { id: 'clavius', name: 'Clavius Crater', region: 'Southern highlands', latitude: -58.4, longitude: -14.4, description: 'Explore a southern highlands landing concept with an illustrative balance of terrain and communication constraints.', position: [40, 68] },
  { id: 'custom', name: 'Custom Location', region: 'User-defined coordinates', latitude: 0, longitude: 0, description: 'Define your own landing coordinates. Custom locations use a fixed sample dataset; estimates are not calculated from coordinates or dates.', position: [50, 50] },
]
// Fictional presentation fixtures. These are not lunar calculations.
export const demoAnalyses: Record<string, DemoAnalysis> = {
  shackleton: { sunlight: 87, visibility: 92, obstruction: 12, feasibility: 89 },
  apollo17: { sunlight: 54, visibility: 98, obstruction: 8, feasibility: 82 },
  clavius: { sunlight: 62, visibility: 81, obstruction: 24, feasibility: 71 },
  custom: { sunlight: 70, visibility: 85, obstruction: 18, feasibility: 76 },
}
export const timeline: { label: string; kind: string; segments: [number, number][] }[] = [
  { label: 'Sunlight', kind: 'sunlight', segments: [[0, 34], [40, 72], [79, 100]] },
  { label: 'Earth visibility', kind: 'visibility', segments: [[0, 23], [29, 61], [68, 100]] },
  { label: 'Blackout', kind: 'blackout', segments: [[23, 29], [61, 68]] },
]
export const initialRequest: AnalysisRequest = { siteId: 'shackleton', latitude: -89.9, longitude: 0, landingDate: '2027-03-15' }
export const scenarios: Scenario[] = landingSites.slice(0, 3).map((site, index) => ({ site, label: `0${index + 1}`, analysis: demoAnalyses[site.id] }))

// Editorial demo assessments, not computed operational feasibility decisions.
export type ScenarioStatus = 'pass' | 'caution' | 'fail'
export interface ScenarioAssessment { status: ScenarioStatus; label: string; summary: string; reasons: string[]; suggestion: string }
export const scenarioAssessments: Record<string, ScenarioAssessment> = {
  shackleton: { status: 'pass', label: 'Favorable demo', summary: 'Balanced sample coverage', reasons: ['The preset illustrates a favorable combination of illumination and Earth visibility.'], suggestion: 'Compare another preset to explore the tradeoffs.' },
  apollo17: { status: 'caution', label: 'Review required', summary: 'Limited sample illumination', reasons: ['The sample sunlight coverage is lower than the baseline.', 'Earth visibility alone does not resolve the illustrative illumination constraint.'], suggestion: 'Explore a different landing window in a future scientific analysis.' },
  clavius: { status: 'fail', label: 'Demo constraints fail', summary: 'Visibility and terrain constraints', reasons: ['Earth visibility is lower than the other preset scenarios.', 'The higher sample terrain obstruction introduces an additional planning constraint.'], suggestion: 'Compare a nearby site or a different landing date when real analysis is available.' },
}

// Deterministic decorative crater geometry, not measured terrain data.
export const moonCraters = Array.from({ length: 95 }, (_, index) => ({
  x: 7 + ((index * 37 + 13) % 86),
  y: 6 + ((index * 53 + 29) % 87),
  size: index < 12 ? 7 + (index % 5) * 1.7 : 1.2 + ((index * 7) % 35) / 10,
}))
