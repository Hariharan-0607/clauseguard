import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { login, signup } from '../api/client.js'
import { Spinner } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useT } from '../ui.jsx'
import Icon from '../components/Icon.jsx'

const DEMO_PASSWORD = 'demo1234'
// One demo account per RBAC role — click any to sign in instantly.
const DEMO_ACCOUNTS = [
  { role: 'user', email: 'user@clauseguard.app', desc: 'Run checks, own cases, estimates, agent' },
  { role: 'caseworker', email: 'caseworker@clauseguard.app', desc: 'Manage & assign any case' },
  { role: 'reviewer', email: 'reviewer@clauseguard.app', desc: 'Override AI detection findings' },
  { role: 'admin', email: 'admin@clauseguard.app', desc: 'Full access + manage roles' },
]
const ROLE_COLOR = {
  user: 'bg-slate-100 text-mute', caseworker: 'bg-blue-50 text-blue-600',
  reviewer: 'bg-amber-50 text-amber-600', admin: 'bg-teal/10 text-teal',
}

export default function Login() {
  const tr = useT()
  const nav = useNavigate()
  const loc = useLocation()
  const { signIn } = useAuth()
  const dest = loc.state?.from || '/'
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(creds) {
    setBusy(true); setError('')
    try {
      const body = creds || form
      const res = mode === 'signup' && !creds
        ? await signup(body)
        : await login({ email: body.email, password: body.password })
      signIn(res)
      nav(dest, { replace: true })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  function useDemo(email) {
    const creds = { email, password: DEMO_PASSWORD }
    setForm({ ...form, ...creds })
    submit(creds)
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex items-center justify-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ background: 'var(--navy)' }}>
          <Icon name="shield" size={18} />
        </span>
        <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--navy)' }}>ClauseGuard</span>
      </div>

      {/* Demo accounts — one per role, click to sign in instantly */}
      <div className="mb-4 rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--brand-50)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}><T>Try a demo role</T></p>
        <p className="mt-0.5 text-xs text-mute">
          <T>All use password</T> <span className="font-mono font-semibold" style={{ color: 'var(--ink)' }}>{DEMO_PASSWORD}</span>. <T>Click to sign in.</T>
        </p>
        <div className="mt-3 space-y-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.email} onClick={() => useDemo(a.email)} disabled={busy}
              className="flex w-full items-center gap-3 rounded-lg border bg-white/60 p-2.5 text-left transition hover:shadow-sm disabled:opacity-60"
              style={{ borderColor: 'var(--line)' }}>
              <span className={`chip shrink-0 capitalize ${ROLE_COLOR[a.role]}`}>{tr(a.role)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs font-semibold" style={{ color: 'var(--ink)' }}>{a.email}</span>
                <span className="block truncate text-[11px] text-mute">{tr(a.desc)}</span>
              </span>
              <Icon name="arrow" size={14} className="shrink-0 text-mute" />
            </button>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}>
          {mode === 'signup' ? 'Create your free account' : 'Sign in to ClauseGuard'}
        </h1>
        <p className="mt-1 text-sm text-mute">Save your contracts, deadlines and history. 100% free.</p>

        {error && (
          <div className="mt-4 rounded-lg border-l-2 border-l-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        <div className="mt-5 space-y-3">
          {mode === 'signup' && (
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={tr('Your name')} className="field" />
          )}
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder={tr('Email')} type="email" className="field" />
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={tr('Password (6+ characters)')} type="password" className="field"
            onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <button onClick={() => submit()} disabled={busy} className="btn-primary w-full py-2.5">
            {busy ? <><Spinner /> Please wait…</> : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </div>

        <p className="mt-4 text-center text-sm text-mute">
          {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
          <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError('') }}
            className="font-semibold text-brand hover:underline" style={{ color: 'var(--brand)' }}>
            {mode === 'signup' ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  )
}
