import { demoAnalyses, type AnalysisRequest, type DemoAnalysis } from '../data/mockData'

// Future integration boundary: replace this adapter with a validated HTTP client
// for POST /api/v1/analysis once the backend contract exists. No request is made.
export const ANALYSIS_ENDPOINT = '/api/v1/analysis'
export async function analyzeMissionDemo(request: AnalysisRequest): Promise<DemoAnalysis> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 1200))
  return demoAnalyses[request.siteId] ?? demoAnalyses.custom
}
