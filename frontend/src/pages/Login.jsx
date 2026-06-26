import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { login, signup } from '../api/client.js'
import { Spinner } from '../components/States.jsx'
import Icon from '../components/Icon.jsx'

const DEMO = { email: 'demo@clauseguard.app', password: 'demo1234' }

export default function Login() {
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

  function useDemo() {
    setForm({ ...form, ...DEMO })
    submit(DEMO)
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex items-center justify-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ background: 'var(--navy)' }}>
          <Icon name="shield" size={18} />
        </span>
        <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--navy)' }}>ClauseGuard</span>
      </div>

      {/* Demo banner */}
      <div className="mb-4 rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--brand-50)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>Demo account</p>
        <p className="mt-1 text-xs text-mute">
          Email <span className="font-mono font-semibold" style={{ color: 'var(--ink)' }}>{DEMO.email}</span> ·
          Password <span className="font-mono font-semibold" style={{ color: 'var(--ink)' }}>{DEMO.password}</span>
        </p>
        <button onClick={useDemo} disabled={busy} className="btn-primary mt-3 w-full py-2 text-sm">
          {busy ? <><Spinner /> Signing in…</> : 'Log in as demo user'}
        </button>
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
              placeholder="Your name" className="field" />
          )}
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email" type="email" className="field" />
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Password (6+ characters)" type="password" className="field"
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
