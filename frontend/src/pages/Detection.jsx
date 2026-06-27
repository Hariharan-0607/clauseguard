import { useEffect, useState } from 'react'
import { detectionAnalytics, listDetectionDomains, runDetection } from '../api/client.js'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useT } from '../ui.jsx'
import Icon from '../components/Icon.jsx'

const SEV_COLOR = {
  low: 'bg-slate-100 text-mute',
  medium: 'bg-amber-50 text-amber-600',
  high: 'bg-orange-50 text-orange-600',
  critical: 'bg-red-50 text-red-600',
}

function SeverityChip({ severity }) {
  return <span className={`chip ${SEV_COLOR[severity] || SEV_COLOR.low}`}><T>{severity}</T></span>
}

// Dashboard widget — reusable severity/category snapshot for a domain.
export function DetectionDashboard({ domain }) {
  const [data, setData] = useState(null)
  useEffect(() => { if (domain) detectionAnalytics(domain).then(setData).catch(() => {}) }, [domain])
  if (!data) return null
  return (
    <section className="card p-5">
      <h3 className="font-bold" style={{ color: 'var(--navy)' }}><T>Trends</T></h3>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <Stat label="Checks" value={data.total_detections} />
        <Stat label="Findings" value={data.total_findings} />
        <Stat label="Avg risk" value={data.average_risk_score} />
      </div>
      {data.top_categories?.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-mute"><T>Top categories</T></p>
          {data.top_categories.slice(0, 5).map(([label, count]) => (
            <div key={label} className="flex justify-between py-0.5 text-sm">
              <span className="text-ink"><T>{label}</T></span><span className="text-mute">{count}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
      <div className="text-xl font-extrabold" style={{ color: 'var(--navy)' }}>{value}</div>
      <div className="text-xs text-mute"><T>{label}</T></div>
    </div>
  )
}

export default function Detection() {
  const tr = useT()
  const [domains, setDomains] = useState([])
  const [domain, setDomain] = useState('human_rights')
  const [form, setForm] = useState({ text: '', title: 'Document', subject: '', region: '', industry: '', jurisdiction: 'IN' })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { listDetectionDomains().then(setDomains).catch((e) => setError(e.message)) }, [])

  async function run() {
    if (!form.text.trim()) return
    setLoading(true); setError(''); setResult(null)
    try { setResult(await runDetection({ domain, ...form, language: 'en' })) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Detection engine</T></h1>
          <p className="text-mute"><T>Scan a document or situation for violations, exploitation and unfair practices.</T></p>
        </div>
        {error && <ErrorState message={error} />}

        <section className="card space-y-3 p-5">
          <div className="flex flex-wrap gap-2">
            {domains.map((d) => (
              <button key={d.domain} onClick={() => setDomain(d.domain)}
                className={`chip ${domain === d.domain ? 'bg-teal text-white' : 'bg-slate-100 text-mute'}`}>
                {tr(d.label)}
              </button>
            ))}
          </div>
          <input className="field" placeholder={tr('Title')} value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="field" placeholder={tr('Subject (employer/landlord)')} value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <input className="field" placeholder={tr('Region')} value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })} />
            <input className="field" placeholder={tr('Industry')} value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </div>
          <textarea className="field min-h-[160px]" placeholder={tr('Paste the contract / policy / situation text here…')}
            value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
          <button onClick={run} disabled={loading} className="btn-primary">
            {loading ? tr('Scanning…') : tr('Run detection')}
          </button>
        </section>

        {result && (
          <section className="space-y-3">
            <div className="card flex items-center gap-3 p-5">
              <span className="icon-tile h-10 w-10"><Icon name="shield" size={20} /></span>
              <div className="flex-1">
                <div className="font-bold text-ink">{result.title}</div>
                <div className="text-sm text-mute">{result.findings.length} <T>findings</T> · <T>risk</T> {result.risk_score}</div>
              </div>
              <SeverityChip severity={result.severity} />
            </div>
            {result.findings.map((f) => (
              <div key={f.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{tr(f.category_label)}</span>
                  <SeverityChip severity={f.severity} />
                </div>
                <p className="mt-1 text-sm text-ink">{f.explanation}</p>
                {f.evidence && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs italic text-mute">“{f.evidence}”</p>}
                {f.laws?.length > 0 && <p className="mt-2 text-xs text-mute"><T>Law</T>: {f.laws.join('; ')}</p>}
                {f.recommended_actions?.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-ink">
                    {f.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                )}
                <div className="mt-2 text-xs text-mute"><T>Probability</T> {Math.round(f.probability * 100)}% · <T>Confidence</T> {Math.round(f.confidence * 100)}%</div>
              </div>
            ))}
          </section>
        )}
      </div>

      <div className="space-y-5"><DetectionDashboard domain={domain} /></div>
    </div>
  )
}
