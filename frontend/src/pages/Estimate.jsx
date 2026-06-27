import { useState } from 'react'
import { estimateCompensation, estimateCost, estimateSettlement } from '../api/client.js'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'

const CLAIM_FIELDS = {
  wage_theft: [['monthly_wage', 'Monthly wage'], ['months_unpaid', 'Months unpaid']],
  overtime: [['overtime_hours', 'Overtime hours'], ['hourly_rate', 'Hourly rate']],
  deposit: [['deposit_amount', 'Deposit amount'], ['lawful_deductions', 'Lawful deductions']],
  consumer: [['amount_paid', 'Amount paid']],
  insurance: [['claimed_amount', 'Claimed amount'], ['amount_paid', 'Amount paid']],
  benefits: [['monthly_wage', 'Monthly wage'], ['years_served', 'Years served']],
}

function Result({ est }) {
  if (!est) return null
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-bold capitalize" style={{ color: 'var(--navy)' }}>{est.kind} <T>estimate</T></h3>
        {est.probability > 0 && <span className="chip bg-teal/10 text-teal">{Math.round(est.probability * 100)}% <T>success</T></span>}
      </div>
      <div className="my-3 text-center">
        <div className="text-3xl font-extrabold" style={{ color: 'var(--navy)' }}>
          {est.currency} {est.amount_mid.toLocaleString()}
        </div>
        <div className="text-sm text-mute">{est.currency} {est.amount_low.toLocaleString()} – {est.amount_high.toLocaleString()}</div>
      </div>
      <div className="space-y-1">
        {est.breakdown.map((b, i) => (
          <div key={i} className="flex justify-between border-b py-1 text-sm" style={{ borderColor: 'var(--border)' }}>
            <span className="text-ink">{b.label}<span className="ml-1 text-xs text-mute">{b.note}</span></span>
            <span className="font-medium text-ink">{est.currency} {b.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
      {est.legal_basis?.length > 0 && <p className="mt-3 text-xs text-mute"><T>Legal basis</T>: {est.legal_basis.join('; ')}</p>}
      <p className="mt-1 text-xs italic text-slate-400">{est.notes}</p>
    </section>
  )
}

export default function Estimate() {
  const [tab, setTab] = useState('compensation')
  const [claimType, setClaimType] = useState('wage_theft')
  const [inputs, setInputs] = useState({})
  const [settle, setSettle] = useState({ claim_amount: '', evidence_strength: 0.5 })
  const [cost, setCost] = useState({ forum: 'civil_court', complexity: 1.0, claim_amount: '' })
  const [est, setEst] = useState(null)
  const [error, setError] = useState('')

  async function runComp() {
    setError('')
    try {
      const numeric = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, Number(v) || 0]))
      setEst(await estimateCompensation({ claim_type: claimType, currency: 'INR', inputs: numeric }))
    } catch (e) { setError(e.message) }
  }
  async function runSettle() {
    setError('')
    try {
      setEst(await estimateSettlement({ claim_amount: Number(settle.claim_amount) || 0, currency: 'INR', evidence_strength: Number(settle.evidence_strength) }))
    } catch (e) { setError(e.message) }
  }
  async function runCost() {
    setError('')
    try {
      setEst(await estimateCost({ forum: cost.forum, complexity: Number(cost.complexity), claim_amount: Number(cost.claim_amount) || 0, currency: 'INR' }))
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Estimators</T></h1>
          <p className="text-mute"><T>Estimate what you could recover, and a realistic settlement range.</T></p>
        </div>
        {error && <ErrorState message={error} />}

        <div className="flex gap-2">
          {['compensation', 'settlement', 'cost'].map((t) => (
            <button key={t} onClick={() => { setTab(t); setEst(null) }}
              className={`chip capitalize ${tab === t ? 'bg-teal text-white' : 'bg-slate-100 text-mute'}`}>{t}</button>
          ))}
        </div>

        {tab === 'cost' ? (
          <section className="card space-y-3 p-5">
            <select className="field" value={cost.forum} onChange={(e) => setCost({ ...cost, forum: e.target.value })}>
              {['consumer_forum', 'labour_court', 'civil_court', 'high_court', 'tribunal'].map((f) => (
                <option key={f} value={f}>{f.replace('_', ' ')}</option>
              ))}
            </select>
            <input type="number" className="field" placeholder="Claim amount"
              value={cost.claim_amount} onChange={(e) => setCost({ ...cost, claim_amount: e.target.value })} />
            <label className="block text-sm text-mute"><T>Case complexity</T>: {Number(cost.complexity).toFixed(1)}x
              <input type="range" min="0.5" max="2" step="0.1" className="mt-1 w-full"
                value={cost.complexity} onChange={(e) => setCost({ ...cost, complexity: e.target.value })} />
            </label>
            <button onClick={runCost} className="btn-primary"><T>Predict legal costs</T></button>
          </section>
        ) : tab === 'compensation' ? (
          <section className="card space-y-3 p-5">
            <select className="field" value={claimType} onChange={(e) => { setClaimType(e.target.value); setInputs({}) }}>
              {Object.keys(CLAIM_FIELDS).map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
            </select>
            {CLAIM_FIELDS[claimType].map(([key, label]) => (
              <input key={key} type="number" className="field" placeholder={label}
                value={inputs[key] || ''} onChange={(e) => setInputs({ ...inputs, [key]: e.target.value })} />
            ))}
            <button onClick={runComp} className="btn-primary"><T>Estimate compensation</T></button>
          </section>
        ) : (
          <section className="card space-y-3 p-5">
            <input type="number" className="field" placeholder="Claim amount"
              value={settle.claim_amount} onChange={(e) => setSettle({ ...settle, claim_amount: e.target.value })} />
            <label className="block text-sm text-mute"><T>Evidence strength</T>: {Math.round(settle.evidence_strength * 100)}%
              <input type="range" min="0" max="1" step="0.05" className="mt-1 w-full"
                value={settle.evidence_strength} onChange={(e) => setSettle({ ...settle, evidence_strength: e.target.value })} />
            </label>
            <button onClick={runSettle} className="btn-primary"><T>Estimate settlement</T></button>
          </section>
        )}
      </div>

      <div className="space-y-5"><Result est={est} /></div>
    </div>
  )
}
