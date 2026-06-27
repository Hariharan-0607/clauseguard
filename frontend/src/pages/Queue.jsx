import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { caseAnalytics, listCases, updateCase } from '../api/client.js'
import { useAuth } from '../auth.jsx'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import Icon from '../components/Icon.jsx'

// Caseworkers and admins manage the shared case queue.
const CAN_MANAGE = ['caseworker', 'admin']

const STATUSES = ['open', 'in_progress', 'filed', 'resolved', 'closed']
const STATUS_COLOR = {
  open: 'bg-slate-100 text-mute', in_progress: 'bg-amber-50 text-amber-600',
  filed: 'bg-blue-50 text-blue-600', resolved: 'bg-green-50 text-green-600',
  closed: 'bg-slate-100 text-slate-400',
}
const PRIORITY_COLOR = {
  low: 'text-slate-400', medium: 'text-mute', high: 'text-orange-600', urgent: 'text-red-600',
}

export default function Queue() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState(null)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

  const load = () => {
    listCases().then(setRows).catch((e) => setError(e.message))
    caseAnalytics().then(setStats).catch(() => {})
  }
  useEffect(() => { if (user && CAN_MANAGE.includes(user.role)) load() }, [user])

  if (user && !CAN_MANAGE.includes(user.role)) return <Navigate to="/" replace />

  async function advance(c) {
    const idx = STATUSES.indexOf(c.status)
    const next = STATUSES[Math.min(idx + 1, STATUSES.length - 1)]
    if (next === c.status) return
    try { await updateCase(c.id, { status: next }); load() }
    catch (e) { setError(e.message) }
  }

  async function claim(c) {
    try { await updateCase(c.id, { assignee_id: user.id }); load() }
    catch (e) { setError(e.message) }
  }

  const shown = filter === 'all' ? rows : rows.filter((c) => c.status === filter)
  const active = rows.filter((c) => !['resolved', 'closed'].includes(c.status)).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Case queue</T></h1>
        <p className="text-mute"><T>Manage, claim and advance cases across all users.</T></p>
      </div>
      {error && <ErrorState message={error} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active" value={active} />
        <Stat label="Total" value={stats?.total ?? rows.length} />
        <Stat label="Resolved" value={`${Math.round((stats?.resolution_rate ?? 0) * 100)}%`} />
        <Stat label="Urgent" value={rows.filter((c) => c.priority === 'urgent').length} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter('all')}
          className={`chip ${filter === 'all' ? 'bg-teal text-white' : 'bg-slate-100 text-mute'}`}>all</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`chip ${filter === s ? 'bg-teal text-white' : 'bg-slate-100 text-mute'}`}>{s}</button>
        ))}
      </div>

      <div className="space-y-2">
        {shown.length === 0 && <p className="text-mute"><T>No cases in this view.</T></p>}
        {shown.map((c) => (
          <div key={c.id} className="card flex items-center gap-3 p-4">
            <span className="icon-tile h-9 w-9"><Icon name="file" size={16} /></span>
            <button onClick={() => nav(`/cases?open=${c.id}`)} className="min-w-0 flex-1 text-left">
              <div className="truncate font-semibold text-ink">{c.title}</div>
              <div className="text-xs text-mute">
                {c.category} · <span className={`font-medium ${PRIORITY_COLOR[c.priority]}`}>{c.priority}</span>
              </div>
            </button>
            <span className={`chip ${STATUS_COLOR[c.status]}`}>{c.status}</span>
            <button onClick={() => claim(c)} className="rounded-lg border px-2.5 py-1 text-xs font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }} title="Assign to me">
              <T>Claim</T>
            </button>
            <button onClick={() => advance(c)} disabled={['resolved', 'closed'].includes(c.status)}
              className="rounded-lg bg-teal px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
              title="Advance status">
              <T>Advance</T> →
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-2xl font-extrabold" style={{ color: 'var(--navy)' }}>{value}</div>
      <div className="text-xs text-mute"><T>{label}</T></div>
    </div>
  )
}
