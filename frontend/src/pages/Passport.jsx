import { useEffect, useState } from 'react'
import { getPassport, updatePassport } from '../api/client.js'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useT } from '../ui.jsx'
import Icon from '../components/Icon.jsx'

const KINDS = [
  ['worker', 'Worker', 'briefcase'],
  ['migrant', 'Migrant', 'globe'],
  ['rental', 'Rental', 'home'],
]

// fields offered for the record form, per vertical
const FIELDS = {
  worker: [['employer', 'Employer'], ['wage', 'Monthly wage'], ['start_date', 'Start date'], ['certifications', 'Certifications']],
  migrant: [['origin_country', 'Origin country'], ['destination', 'Destination'], ['recruiter', 'Recruiter'], ['contract_verified', 'Contract verified (yes/no)']],
  rental: [['address', 'Address'], ['rent', 'Monthly rent'], ['deposit', 'Deposit'], ['lease_end', 'Lease end date']],
}

const BAND_COLOR = { strong: 'text-green-600', moderate: 'text-amber-600', 'at risk': 'text-red-600' }

export default function Passport() {
  const tr = useT()
  const [kind, setKind] = useState('worker')
  const [data, setData] = useState(null)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')

  const load = (k) => getPassport(k).then((d) => { setData(d); setForm({}) }).catch((e) => setError(e.message))
  useEffect(() => { load(kind) }, [kind])

  async function save() {
    try { setData(await updatePassport(kind, { records: form })); setForm({}) }
    catch (e) { setError(e.message) }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Protection passport</T></h1>
          <p className="text-mute"><T>A portable record of your rights, risks and protection status.</T></p>
        </div>
        {error && <ErrorState message={error} />}

        <div className="flex gap-2">
          {KINDS.map(([k, label, icon]) => (
            <button key={k} onClick={() => setKind(k)}
              className={`chip flex items-center gap-1 ${kind === k ? 'bg-teal text-white' : 'bg-slate-100 text-mute'}`}>
              <Icon name={icon} size={13} /> {tr(label)}
            </button>
          ))}
        </div>

        <section className="card space-y-3 p-5">
          <h3 className="font-bold" style={{ color: 'var(--navy)' }}><T>Your record</T></h3>
          {FIELDS[kind].map(([key, label]) => (
            <input key={key} className="field" placeholder={tr(label)}
              value={form[key] ?? ''}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          ))}
          <button onClick={save} className="btn-primary"><T>Save record</T></button>
        </section>

        {data?.rights?.length > 0 && (
          <section className="card p-5">
            <h3 className="font-bold" style={{ color: 'var(--navy)' }}><T>Your rights</T></h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
              {data.rights.map((r, i) => <li key={i}>{tr(r)}</li>)}
            </ul>
          </section>
        )}
      </div>

      <div className="space-y-5">
        {data && (
          <section className="card p-5 text-center">
            <h3 className="font-bold" style={{ color: 'var(--navy)' }}><T>Trust score</T></h3>
            <div className={`mt-2 text-5xl font-extrabold ${BAND_COLOR[data.trust_band] || ''}`}>{data.trust_score}</div>
            <div className={`text-sm font-medium capitalize ${BAND_COLOR[data.trust_band] || 'text-mute'}`}>{tr(data.trust_band)}</div>
            <div className="mt-3 text-xs text-mute"><T>Record completeness</T>: {data.record_completeness}%</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <Mini label="Checks" value={data.stats.checks_run} />
              <Mini label="Open cases" value={data.stats.open_cases} />
              <Mini label="Estimates" value={data.stats.estimates} />
            </div>
            {data.risk_factors?.length > 0 && (
              <div className="mt-4 text-left">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-mute"><T>Risk factors</T></p>
                {data.risk_factors.map((f, i) => (
                  <div key={i} className="rounded bg-red-50 px-2 py-1 text-xs text-red-600">{tr(f)}</div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function Mini({ label, value }) {
  return (
    <div className="rounded-lg border p-2" style={{ borderColor: 'var(--border)' }}>
      <div className="text-lg font-bold" style={{ color: 'var(--navy)' }}>{value}</div>
      <div className="text-mute"><T>{label}</T></div>
    </div>
  )
}
