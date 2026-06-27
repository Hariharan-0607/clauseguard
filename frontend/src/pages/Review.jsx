import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { reviewFinding, reviewQueue } from '../api/client.js'
import { useAuth } from '../auth.jsx'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import Icon from '../components/Icon.jsx'

const SEV_COLOR = {
  low: 'bg-slate-100 text-mute', medium: 'bg-amber-50 text-amber-600',
  high: 'bg-orange-50 text-orange-600', critical: 'bg-red-50 text-red-600',
}
const VERDICTS = [
  ['confirmed', 'Confirm', 'bg-green-600'],
  ['adjusted', 'Adjust', 'bg-amber-500'],
  ['dismissed', 'Dismiss', 'bg-slate-500'],
]

// Reviewers and admins only.
const CAN_REVIEW = ['reviewer', 'admin']

export default function Review() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [pendingOnly, setPendingOnly] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)

  const load = () => reviewQueue(pendingOnly).then(setItems).catch((e) => setError(e.message))
  useEffect(() => { if (user && CAN_REVIEW.includes(user.role)) load() }, [user, pendingOnly])

  if (user && !CAN_REVIEW.includes(user.role)) return <Navigate to="/" replace />

  async function decide(finding_id, verdict) {
    setBusy(finding_id); setError('')
    try { await reviewFinding(finding_id, verdict); await load() }
    catch (e) { setError(e.message) }
    finally { setBusy(null) }
  }

  const pending = items.filter((i) => !i.reviewed).length

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Review queue</T></h1>
          <p className="text-mute"><T>Confirm, adjust or dismiss AI-detected findings.</T></p>
        </div>
        <button onClick={() => setPendingOnly(!pendingOnly)}
          className={`chip ${pendingOnly ? 'bg-teal text-white' : 'bg-slate-100 text-mute'}`}>
          {pendingOnly ? 'Pending only' : 'All findings'}
        </button>
      </div>
      {error && <ErrorState message={error} />}

      <div className="card flex items-center gap-3 p-4">
        <span className="icon-tile h-9 w-9"><Icon name="scale" size={18} /></span>
        <div className="text-sm text-ink">
          <span className="font-bold">{pending}</span> <T>pending review</T>
          <span className="text-mute"> · {items.length} <T>shown</T></span>
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-mute"><T>Nothing to review right now.</T></p>}
        {items.map((it) => (
          <div key={it.finding_id} className={`card p-4 ${it.reviewed ? 'opacity-70' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-semibold text-ink">{it.category_label}</span>
                <span className="ml-2 text-xs text-mute">{it.detection_title} · {it.domain}</span>
              </div>
              <span className={`chip ${SEV_COLOR[it.severity]}`}>{it.severity}</span>
            </div>
            <p className="mt-1 text-sm text-ink">{it.explanation}</p>
            {it.evidence && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs italic text-mute">“{it.evidence}”</p>}
            <div className="mt-1 text-xs text-mute"><T>Probability</T> {Math.round(it.probability * 100)}% · <T>Confidence</T> {Math.round(it.confidence * 100)}%</div>

            {it.reviewed ? (
              <div className="mt-3 text-sm font-medium" style={{ color: 'var(--accent)' }}>
                <Icon name="check" size={14} className="inline" /> <T>Reviewed</T>: {it.review_verdict}
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                {VERDICTS.map(([v, label, bg]) => (
                  <button key={v} onClick={() => decide(it.finding_id, v)} disabled={busy === it.finding_id}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${bg}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
