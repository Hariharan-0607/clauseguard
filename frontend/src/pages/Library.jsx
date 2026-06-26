import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listTopics } from '../api/client.js'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useUI } from '../ui.jsx'
import Icon from '../components/Icon.jsx'

const ICONS = { deposits: 'shield', eviction: 'home', wages: 'briefcase', overtime: 'clock', noncompete: 'file', 'unfair-terms': 'scale' }

export default function Library() {
  const [topics, setTopics] = useState(null)
  const [error, setError] = useState('')
  const load = () => { setError(''); listTopics().then(setTopics).catch((e) => setError(e.message)) }
  useEffect(load, [])

  useUI().version

  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Know your rights</T></h1>
        <p className="mt-1.5 text-mute"><T>Plain-language guides — no contract needed.</T></p>
      </header>
      {!topics
        ? <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
        : (
          <div className="grid gap-4 sm:grid-cols-2">
            {topics.map((t, i) => (
              <Link key={t.id} to={`/library/${t.id}`}
                className="card card-hover group p-5 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-start gap-4">
                  <span className="icon-tile h-10 w-10 shrink-0"><Icon name={ICONS[t.id] || 'file'} size={18} /></span>
                  <div>
                    <h3 className="font-semibold" style={{ color: 'var(--navy)' }}><T>{t.title}</T></h3>
                    <p className="mt-1 text-sm leading-relaxed text-mute"><T>{t.summary}</T></p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
    </div>
  )
}
