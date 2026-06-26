import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTopic } from '../api/client.js'
import { ErrorState } from '../components/States.jsx'
import Icon from '../components/Icon.jsx'

const ICONS = { deposits: 'shield', eviction: 'home', wages: 'briefcase', overtime: 'clock', noncompete: 'file', 'unfair-terms': 'scale' }

export default function Topic() {
  const { id } = useParams()
  const [t, setT] = useState(null)
  const [error, setError] = useState('')
  const load = () => { setError(''); getTopic(id).then(setT).catch((e) => setError(e.message)) }
  useEffect(load, [id])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!t) return <div className="skeleton h-64 rounded-2xl" />

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Link to="/library" className="inline-flex items-center gap-1.5 text-sm font-medium text-mute hover:text-ink">
        <Icon name="arrow" size={15} className="rotate-180" /> All topics
      </Link>
      <header className="flex items-center gap-4">
        <span className="icon-tile h-12 w-12"><Icon name={ICONS[t.id] || 'file'} size={22} /></span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}>{t.title}</h1>
          <p className="text-mute">{t.summary}</p>
        </div>
      </header>

      <section className="card p-6">
        {t.body.split('\n\n').map((p, i) => (
          <p key={i} className="mb-4 leading-relaxed last:mb-0" style={{ color: "var(--text-2)" }}>{p}</p>
        ))}
      </section>

      <section className="card p-6">
        <p className="label">Your rights at a glance</p>
        <ul className="space-y-2.5">
          {t.rights.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5" style={{ color: "var(--text-2)" }}>
              <Icon name="check" size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--teal)' }} />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to="/check" className="btn-primary">Check my contract</Link>
        <Link to="/help" className="btn-ghost">Find legal help</Link>
      </div>
    </article>
  )
}
