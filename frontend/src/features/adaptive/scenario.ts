/** Fictional screen-space scenario. No real coordinates, thresholds, or AI inference. */
export const demoDestinations = [
  { id: 'planned', name: 'Planned zone', x: 51, y: 63, tone: 'red', symbol: 'x', outcome: 'success', reason: 'A scripted surface warning prompts you to review the planned landing. Confirming keeps the original destination and continues the demo descent.' },
  { id: 'alternate', name: 'Alternate Alpha', x: 29, y: 55, tone: 'green', symbol: '+', outcome: 'success', reason: 'This fictional route demonstrates a completed landing after a course change.' },
  { id: 'unsupported', name: 'Alternate Bravo', x: 74, y: 57, tone: 'orange', symbol: '!', outcome: 'failure', reason: 'This fictional route demonstrates an unsuccessful descent.' },
] as const
export type DestinationId = typeof demoDestinations[number]['id']
export type Phase = 'ready' | 'approach' | 'decision' | 'divert' | 'descent' | 'success' | 'failure'
export interface ScenarioState { phase: Phase; elapsed: number; paused: boolean; map: boolean; destination: DestinationId; proposal: DestinationId | null }
export const initialScenario: ScenarioState = { phase: 'ready', elapsed: 0, paused: false, map: false, destination: 'planned', proposal: null }
export type Action = { type: 'tick'; delta: number } | { type: 'choose'; id: DestinationId } | { type: 'start' | 'reset' | 'pause' | 'map' | 'cancel' | 'confirm' }
export function scenarioReducer(state: ScenarioState, action: Action): ScenarioState {
  if (action.type === 'reset') return { ...initialScenario }
  if (action.type === 'start') return state.phase === 'ready' ? { ...state, phase: 'approach' } : state
  if (action.type === 'pause') return ['approach', 'divert', 'descent'].includes(state.phase) ? { ...state, paused: !state.paused } : state
  if (action.type === 'map') return { ...state, map: !state.map }
  if (action.type === 'choose') return state.phase === 'decision' ? { ...state, proposal: action.id } : state
  if (action.type === 'cancel') return { ...state, proposal: null }
  if (action.type === 'confirm') return state.phase === 'decision' && state.proposal ? { ...state, destination: state.proposal, proposal: null, phase: 'divert', elapsed: 0, paused: false } : state
  if (action.type !== 'tick' || state.paused || !['approach', 'divert', 'descent'].includes(state.phase)) return state
  const elapsed = state.elapsed + action.delta
  if (state.phase === 'approach' && elapsed >= 2000) return { ...state, phase: 'decision', elapsed: 0, map: true }
  if (state.phase === 'divert' && elapsed >= 2500) return { ...state, phase: 'descent', elapsed: 0 }
  if (state.phase === 'descent' && elapsed >= 6000) return { ...state, phase: demoDestinations.find(d => d.id === state.destination)!.outcome, elapsed: 0 }
  return { ...state, elapsed }
}
