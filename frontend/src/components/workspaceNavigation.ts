export const workspaceTabs = [
  { id: 'overview', label: 'Home', target: '#/overview' },
  { id: 'map', label: 'Lunar Map', target: '#/map' },
  { id: 'analysis', label: 'Site Analysis', target: '#/analysis' },
  { id: 'schedule', label: 'Schedule Manager', target: '#/schedule' },
  { id: 'coverage', label: 'Data & Coverage', target: '#/coverage' },
  { id: 'compare', label: 'Compare Scenarios', target: '#/compare' },
] as const

export function workspaceTabForHash(hash: string) {
  const legacy: Record<string, string> = { '#planner': '#/overview', '#lunar-map': '#/map', '#site-analysis': '#/analysis', '#timeline': '#/schedule', '#data-coverage': '#/coverage', '#scenarios': '#/compare' }
  hash = legacy[hash] ?? hash
  return workspaceTabs.find((tab) => tab.target === hash)?.id ?? 'overview'
}
