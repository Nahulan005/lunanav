import { AlertTriangle, ArrowRight, Check, CircleCheck, CircleHelp, CircleX, Layers3 } from 'lucide-react'
import { scenarios, scenarioAssessments, type LandingSite, type Scenario, type ScenarioAssessment, type ScenarioStatus } from '../data/mockData'

interface ScenarioComparisonProps {
  selectedId: string
  disabled: boolean
  onSelect: (site: LandingSite) => void
}

function StatusBadge({ status, label }: { status: ScenarioStatus; label: string }) {
  const Icon = status === 'pass' ? CircleCheck : status === 'caution' ? AlertTriangle : CircleX
  return <span className={`assessment-badge ${status}`}><Icon size={12} />{label}</span>
}

function ScenarioDetails({ scenario, assessment }: { scenario: Scenario; assessment: ScenarioAssessment }) {
  const { site, label, analysis } = scenario
  const { status, reasons, suggestion } = assessment
  const Icon = status === 'pass' ? CircleCheck : status === 'caution' ? AlertTriangle : CircleX
  const title = status === 'pass'
    ? 'Why this scenario is favorable'
    : status === 'caution' ? 'Why this scenario needs review' : 'Why this scenario fails'
  const outcome = status === 'pass'
    ? 'Favorable under demo assumptions'
    : status === 'caution' ? 'Requires review' : 'Fails selected demo constraints'

  return (
    <aside id="scenario-details" className={`panel failure-panel ${status}`} aria-labelledby="scenario-details-title" aria-live="polite" aria-atomic="true">
      <div className="section-heading"><h2 id="scenario-details-title"><Icon size={17} />{title}</h2></div>
      <span className="failure-kicker">SCENARIO {label} / {site.name}</span>
      <StatusBadge status={status} label={outcome} />
      <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      <dl className="scenario-details-values" aria-label="Illustrative demo estimates">
        <div><dt>Sunlight</dt><dd className="sun-text">{analysis.sunlight}%</dd></div>
        <div><dt>Earth visibility</dt><dd className="earth-text">{analysis.visibility}%</dd></div>
        <div><dt>Terrain obstruction</dt><dd>{analysis.obstruction}%</dd></div>
      </dl>
      <div className="failure-suggestion"><span>CONSIDER NEXT</span><p>{suggestion}</p></div>
      <p className="failure-footnote">Illustrative demo data and editorial explanations only. No scientific safety rating or terrain and orbital calculations.</p>
    </aside>
  )
}

export function ScenarioComparison({ selectedId, disabled, onSelect }: ScenarioComparisonProps) {
  const selectedScenario = scenarios.find(({ site }) => site.id === selectedId) ?? scenarios[0]

  function selectScenario(site: LandingSite) {
    if (!disabled) onSelect(site)
  }

  return (
    <div className="comparison-layout" id="scenarios">
      <section className="panel comparison-panel">
        <div className="section-heading">
          <div><h2><Layers3 size={17} />Multi-scenario comparison</h2><p>Select a scenario to explore its illustrative estimates and explanation.</p></div>
          <span className="small-badge">DEMO ESTIMATES</span>
        </div>
        <div className="scenario-summaries" role="group" aria-label="Select a demo scenario">
          {scenarios.map(({ site, label }) => {
            const assessment = scenarioAssessments[site.id]
            const selected = selectedScenario.site.id === site.id
            return (
              <button
                type="button"
                className={`scenario-summary ${assessment.status} ${selected ? 'selected-scenario' : ''}`}
                key={site.id}
                disabled={disabled}
                onClick={() => selectScenario(site)}
                aria-pressed={selected}
                aria-controls="scenario-details"
                aria-label={`Select ${site.name} scenario`}
              >
                <span className="scenario-summary-heading">SCENARIO {label}<span>{site.name}</span></span>
                <StatusBadge status={assessment.status} label={assessment.label} />
                <span className="scenario-summary-description">{assessment.summary}</span>
                <span className="scenario-selection-label">{selected ? <><Check size={10} />SELECTED</> : 'SELECT SCENARIO'}</span>
              </button>
            )
          })}
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Select a row or its button to view illustrative estimates and editorial demo assessments. These are not scientific feasibility decisions.</caption>
            <thead><tr><th>Landing scenario</th><th>Sunlight</th><th>Earth visible</th><th>Obstruction</th><th>Demo score</th><th>Assessment</th><th><span className="sr-only">Select scenario</span></th></tr></thead>
            <tbody>
              {scenarios.map(({ site, label, analysis }) => {
                const assessment = scenarioAssessments[site.id]
                const selected = selectedScenario.site.id === site.id
                return (
                  <tr
                    key={site.id}
                    className={`scenario-row ${selected ? 'selected-row' : ''}`}
                    tabIndex={disabled ? -1 : 0}
                    aria-current={selected ? 'true' : undefined}
                    aria-disabled={disabled}
                    onClick={() => selectScenario(site)}
                    onKeyDown={(event) => {
                      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault()
                        selectScenario(site)
                      }
                    }}
                  >
                    <td><div className="scenario-name"><span className="scenario-number">{label}</span><div><strong>{site.name}</strong><span>{site.region}</span></div></div></td>
                    <td className="sun-text">{analysis.sunlight}%</td>
                    <td className="earth-text">{analysis.visibility}%</td>
                    <td>{analysis.obstruction}%</td>
                    <td><span className={`score ${assessment.status}`}>{analysis.feasibility}<small>/100</small></span></td>
                    <td><StatusBadge status={assessment.status} label={assessment.label} /><span className="table-reason">{assessment.summary}</span></td>
                    <td>
                      <button
                        type="button"
                        className="scenario-button"
                        disabled={disabled}
                        aria-label={`Select ${site.name} scenario`}
                        aria-pressed={selected}
                        onClick={(event) => { event.stopPropagation(); selectScenario(site) }}
                      >{selected ? <Check size={16} /> : <ArrowRight size={16} />}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="table-note"><CircleHelp size={13} />Fixed demo assessments. Scores do not establish mission safety or suitability.</div>
      </section>
      <ScenarioDetails scenario={selectedScenario} assessment={scenarioAssessments[selectedScenario.site.id]} />
    </div>
  )
}
