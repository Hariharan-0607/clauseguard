import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { platformStats } from '../api/client.js'
import { useAuth } from '../auth.jsx'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import Icon from '../components/Icon.jsx'

// Admin-only oversight dashboard.
const SEV_COLOR = {
  low: 'text-mute', medium: 'text-amber-600', high: 'text-orange-600', critical: 'text-red-600',
}

function Bars({ data, colorFn }) {
  const entries = Object.entries(data || {})
  const max = Math.max(1, ...entries.map(([, v]) => v))
  if (entries.length === 0) return <p className="text-sm text-mute"><T>No data yet.</T></p>
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-sm">
          <span className={`w-28 shrink-0 truncate capitalize ${colorFn ? colorFn(k) : 'text-ink'}`}><T>{k.replace('_', ' ')}</T></span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: 'var(--accent)' }} />
          </div>
          <span className="w-8 shrink-0 text-right font-medium text-ink">{v}</span>
        </div>
      ))}
    </div>
  )
}

function Kpi({ label, value, icon, to, accent }) {
  const body = (
    <div className="card flex items-center gap-3 p-4">
      <span className="icon-tile h-10 w-10"><Icon name={icon} size={18} /></span>
      <div>
        <div className="text-2xl font-extrabold" style={{ color: accent || 'var(--navy)' }}>{value}</div>
        <div className="text-xs text-mute"><T>{label}</T></div>
      </div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export default function Dashboard() {
  const { user } = useAuth()
  const [s, setS] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { if (user?.role === 'admin') platformStats().then(setS).catch((e) => setError(e.message)) }, [user])
  if (user && user.role !== 'admin') return <Navigate to="/" replace />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Admin dashboard</T></h1>
        <p className="text-mute"><T>Platform oversight — statistics, review and role management.</T></p>
      </div>
      {error && <ErrorState message={error} />}

      {s && (
        <>
          {/* KPIs — pending review is clickable into the override queue */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Users" value={s.users.total} icon="user" to="/roles" />
            <Kpi label="Detections" value={s.detections.total} icon="shield" />
            <Kpi label="Pending review" value={s.findings.pending_review} icon="scale" to="/review"
              accent={s.findings.pending_review > 0 ? '#E11D48' : undefined} />
            <Kpi label="Cases" value={s.cases.total} icon="file" to="/queue" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <h3 className="font-bold" style={{ color: 'var(--navy)' }}><T>Users by role</T></h3>
              <div className="mt-3"><Bars data={s.users.by_role} /></div>
            </section>

            <section className="card p-5">
              <h3 className="font-bold" style={{ color: 'var(--navy)' }}><T>Detections by severity</T></h3>
              <div className="mt-3"><Bars data={s.detections.by_severity} colorFn={(k) => SEV_COLOR[k] || 'text-ink'} /></div>
            </section>

            <section className="card p-5">
              <h3 className="font-bold" style={{ color: 'var(--navy)' }}><T>Detections by domain</T></h3>
              <div className="mt-3"><Bars data={s.detections.by_domain} /></div>
            </section>

            <section className="card p-5">
              <h3 className="font-bold" style={{ color: 'var(--navy)' }}><T>Cases by status</T></h3>
              <div className="mt-3"><Bars data={s.cases.by_status} /></div>
              <p className="mt-3 text-sm text-mute">
                <T>Resolution rate</T>: <span className="font-bold text-ink">{Math.round(s.cases.resolution_rate * 100)}%</span>
              </p>
            </section>
          </div>

          {/* Findings review summary + quick action */}
          <section className="card flex items-center gap-3 p-5">
            <span className="icon-tile h-10 w-10"><Icon name="scale" size={18} /></span>
            <div className="flex-1 text-sm">
              <div className="font-bold text-ink">
                {s.findings.reviewed}/{s.findings.total} <T>findings reviewed</T>
              </div>
              <div className="text-mute">{s.findings.pending_review} <T>awaiting override decision</T></div>
            </div>
            <Link to="/review" className="btn-primary py-2 text-sm"><T>Review findings</T> →</Link>
          </section>
        </>
      )}
    </div>
  )
}
