import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { listUsers, setUserRole } from '../api/client.js'
import { useAuth } from '../auth.jsx'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useT } from '../ui.jsx'
import Icon from '../components/Icon.jsx'

const ROLES = ['user', 'caseworker', 'reviewer', 'admin']
const ROLE_COLOR = {
  user: 'bg-slate-100 text-mute',
  caseworker: 'bg-blue-50 text-blue-600',
  reviewer: 'bg-amber-50 text-amber-600',
  admin: 'bg-teal/10 text-teal',
}

const ROLE_DESC = {
  user: 'Run checks, manage own cases, estimates, agent',
  caseworker: 'Read / update / assign any case',
  reviewer: 'Confirm or override AI detection findings',
  admin: 'Full access + manage user roles',
}

export default function Roles() {
  const { user } = useAuth()
  const tr = useT()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  const load = () => listUsers().then(setRows).catch((e) => setError(e.message))
  useEffect(() => { if (user?.role === 'admin') load() }, [user])

  // admin-only page
  if (user && user.role !== 'admin') return <Navigate to="/" replace />

  async function change(id, role) {
    try { await setUserRole(id, role); load() }
    catch (e) { setError(e.message) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Roles &amp; access</T></h1>
        <p className="text-mute"><T>Assign roles to control who can review findings and manage cases.</T></p>
      </div>
      {error && <ErrorState message={error} />}

      <section className="card p-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="flex items-center gap-2 rounded-lg border p-2 text-sm" style={{ borderColor: 'var(--border)' }}>
              <span className={`chip ${ROLE_COLOR[r]}`}>{tr(r)}</span>
              <span className="text-mute"><T>{ROLE_DESC[r]}</T></span>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-2">
        {rows.map((u) => (
          <div key={u.id} className="card flex items-center gap-3 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold"
              style={{ background: 'var(--highlight)', color: 'var(--text)' }}>
              {(u.name || u.email || '?').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-ink">{u.name || u.email}</div>
              <div className="truncate text-xs text-mute">{u.email}</div>
            </div>
            <span className={`chip ${ROLE_COLOR[u.role]}`}>{tr(u.role)}</span>
            <select value={u.role} onChange={(e) => change(u.id, e.target.value)}
              className="field !w-auto !py-1 text-sm"
              disabled={u.id === user.id}
              title={u.id === user.id ? tr('You cannot change your own role') : ''}>
              {ROLES.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
            </select>
          </div>
        ))}
        {rows.length === 0 && <p className="text-mute"><T>No users found.</T></p>}
      </div>
    </div>
  )
}
