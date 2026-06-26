import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPlan } from '../api/client.js'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useUI } from '../ui.jsx'
import Icon from '../components/Icon.jsx'
import PrintHeader from '../components/PrintHeader.jsx'

const URGENCY = {
  high: { label: 'Act now', color: '#E11D48', bg: '#FEF2F2' },
  medium: { label: 'Act soon', color: '#D97706', bg: '#FFFBEB' },
  low: { label: 'No rush', color: '#0EA5A0', bg: '#E6F7F5' }
}

export default function SavedPlan() {
  const { id } = useParams()
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const load = () => { setError(''); getPlan(id).then(setPlan).catch((e) => setError(e.message)) }
  useEffect(load, [id])
  useUI().version

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!plan) return <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}</div>

  const u = URGENCY[plan.urgency] || URGENCY.medium

  return (
    <div className="space-y-5">
      <PrintHeader title={plan.title} />
      <div className="no-print">
        <Link to="/history" className="inline-flex items-center gap-1.5 text-sm font-medium text-mute hover:text-ink">
          <Icon name="arrow" size={15} className="rotate-180" /> <T>Back to history</T>
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="flex items-start justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>{plan.category}</p>
            <h2 className="mt-1 text-xl font-bold" style={{ color: 'var(--text)' }}>{plan.title}</h2>
            <p className="mt-2 leading-relaxed" style={{ color: 'var(--text-2)' }}>{plan.summary}</p>
          </div>
          <span className="chip shrink-0" style={{ background: u.bg, color: u.color }}>{u.label}</span>
        </div>
        {plan.deadline_note && (
          <div className="flex items-center gap-2 border-t px-5 py-3 text-sm" style={{ borderColor: 'var(--border)', color: u.color, background: u.bg }}>
            <Icon name="clock" size={15} /> <span>{plan.deadline_note}</span>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon="check" title="What to do" className="lg:row-span-2">
          <ol className="space-y-3">
            {plan.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--primary)', color: 'var(--text-inv)' }}>{i + 1}</span>
                <span className="leading-relaxed" style={{ color: 'var(--text-2)' }}>{s}</span>
              </li>
            ))}
          </ol>
        </Section>
        <Section icon="scale" title="Your rights">
          <ul className="space-y-2">
            {plan.rights.map((r, i) => (
              <li key={i} className="flex items-start gap-2" style={{ color: 'var(--text-2)' }}>
                <Icon name="check" size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--teal)' }} /><span>{r}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section icon="file" title="Documents to prepare">
          <ul className="space-y-2">
            {plan.documents.map((d, i) => (
              <li key={i} className="flex items-start gap-2" style={{ color: 'var(--text-2)' }}>
                <Icon name="file" size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--text-3)' }} /><span>{d}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--highlight)' }}>
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--card)', color: 'var(--accent)' }}>
            <Icon name="help" size={18} />
          </span>
          <div>
            <p className="font-semibold" style={{ color: 'var(--text)' }}><T>Where to get real help</T></p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>{plan.help}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 no-print">
          <button onClick={() => window.print()} className="btn-ghost px-3 py-2 text-sm">
            <Icon name="print" size={15} /> <T>Export PDF</T>
          </button>
          <Link to="/help" className="btn-ghost px-3 py-2 text-sm"><T>Find legal aid near me</T></Link>
        </div>
      </div>

      <p className="text-center text-xs" style={{ color: 'var(--text-3)' }}>
        <T>ClauseGuard gives general guidance, not legal advice. For your specific case, consult a qualified lawyer or free legal aid.</T>
      </p>
    </div>
  )
}

function Section({ icon, title, children, className = '' }) {
  return (
    <div className={`rounded-2xl border p-5 ${className}`} style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: 'var(--highlight)', color: 'var(--accent)' }}>
          <Icon name={icon} size={15} />
        </span>
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}><T>{title}</T></h3>
      </div>
      {children}
    </div>
  )
}
