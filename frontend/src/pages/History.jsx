import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAnalyses, listPlans } from '../api/client.js'
import RiskBadge from '../components/RiskBadge.jsx'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useUI } from '../ui.jsx'
import Icon from '../components/Icon.jsx'

const URG = {
  high: { label: 'Act now', color: '#E11D48', bg: '#FEF2F2' },
  medium: { label: 'Act soon', color: '#D97706', bg: '#FFFBEB' },
  low: { label: 'No rush', color: '#0EA5A0', bg: '#E6F7F5' }
}

export default function History() {
  const [rows, setRows] = useState(null)
  const [plans, setPlans] = useState([])
  const [error, setError] = useState('')
  const load = () => {
    setError('')
    Promise.all([
      listAnalyses().then(setRows),
      listPlans().then(setPlans).catch(() => setPlans([])),
    ]).catch((e) => setError(e.message))
  }
  useEffect(load, [])
  useUI().version

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!rows) return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
  if (rows.length === 0 && plans.length === 0) return (
    <div className="card p-12 text-center">
      <p className="font-semibold" style={{ color: 'var(--navy)' }}><T>Nothing saved yet</T></p>
      <p className="mt-1 text-sm text-mute"><T>Check a contract or save an advisor plan to see it here.</T></p>
      <Link to="/check" className="btn-primary mt-5"><T>Check a contract</T></Link>
    </div>
  )

  return (
    <div className="space-y-8">
      {plans.length > 0 && (
        <div className="space-y-5">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Saved action plans</T></h1>
          <div className="space-y-3">
            {plans.map((p, i) => {
              const u = URG[p.urgency] || URG.medium
              return (
                <Link key={p.id} to={`/plan/${p.id}`}
                  className="card card-hover flex items-center gap-4 p-4 animate-fade-up"
                  style={{ animationDelay: `${i * 40}ms` }}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--highlight)', color: 'var(--accent)' }}>
                    <Icon name="scale" size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>{p.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm" style={{ color: 'var(--text-3)' }}>{p.summary}</p>
                  </div>
                  <span className="chip shrink-0" style={{ background: u.bg, color: u.color }}>{u.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-5">
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Your past checks</T></h1>
        {rows.length === 0 ? (
          <p className="text-sm text-mute"><T>No contract checks yet.</T></p>
        ) : (
          <div className="space-y-3">
            {rows.map((a, i) => (
              <Link key={a.id} to={`/result/${a.id}`}
                className="card card-hover flex items-center gap-4 p-4 animate-fade-up"
                style={{ animationDelay: `${i * 40}ms` }}>
                <div className="min-w-0 flex-1">
                  <RiskBadge level={a.risk_level} score={a.risk_score} />
                  <p className="mt-2 line-clamp-2 text-sm" style={{ color: "var(--text-3)" }}>{a.summary}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-slate-400">{a.jurisdiction} · {a.language}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
