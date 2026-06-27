import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { addDeadline, deleteDeadline, listDeadlines, toggleDeadline } from '../api/client.js'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useT, useUI } from '../ui.jsx'
import Icon from '../components/Icon.jsx'

const KINDS = { rent: 'briefcase', notice: 'file', renewal: 'clock', payment: 'briefcase', other: 'flag' }

export default function Deadlines() {
  const { user } = useAuth()
  const tr = useT()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ title: '', kind: 'notice', due_date: '', notes: '' })
  const [error, setError] = useState('')

  const load = () => listDeadlines().then(setRows).catch((e) => setError(e.message))
  useEffect(() => { if (user) load() }, [user])

  async function add() {
    if (!form.title || !form.due_date) return
    try { await addDeadline(form); setForm({ title: '', kind: 'notice', due_date: '', notes: '' }); load() }
    catch (e) { setError(e.message) }
  }
  const daysLeft = (d) => Math.ceil((new Date(d) - new Date()) / 86400000)

  useUI().version

  if (!user) return (
    <div className="card p-12 text-center">
      <span className="icon-tile mx-auto h-12 w-12"><Icon name="clock" size={22} /></span>
      <p className="mt-4 font-semibold" style={{ color: 'var(--navy)' }}><T>Sign in to track deadlines</T></p>
      <p className="mt-1 text-sm text-mute"><T>Save notice periods, rent dates and renewals — never miss one.</T></p>
      <Link to="/login" className="btn-primary mt-5"><T>Sign in / Sign up</T></Link>
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Deadline tracker</T></h1>
        <p className="text-mute"><T>Notice periods, rent due dates, renewals — all in one place.</T></p>
      </div>
      {error && <ErrorState message={error} />}

      <section className="card grid gap-3 p-5 sm:grid-cols-2">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={tr('e.g. Give 30-day rent notice')} className="field sm:col-span-2" />
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="field">
          {Object.keys(KINDS).map((k) => <option key={k} value={k}>{tr(k)}</option>)}
        </select>
        <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="field" />
        <button onClick={add} className="btn-primary sm:col-span-2">+ {tr('Add deadline')}</button>
      </section>

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-mute">No deadlines yet — add one above.</p>}
        {rows.map((d) => {
          const dl = daysLeft(d.due_date)
          const urgent = dl <= 7 && !d.done
          return (
            <div key={d.id} className={`card flex items-center gap-3 p-4 ${d.done ? 'opacity-60' : ''}`}>
              <button onClick={() => toggleDeadline(d.id).then(load)}
                className={`grid h-6 w-6 place-items-center rounded-full border-2 ${d.done ? 'border-teal bg-teal text-white' : 'border-slate-300'}`}>
                {d.done ? '✓' : ''}
              </button>
              <span className="icon-tile h-9 w-9"><Icon name={KINDS[d.kind] || 'flag'} size={16} /></span>
              <div className="flex-1">
                <div className={`font-semibold text-ink ${d.done ? 'line-through' : ''}`}>{d.title}</div>
                <div className="text-xs text-mute">{d.due_date}</div>
              </div>
              {!d.done && (
                <span className={`chip ${urgent ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-mute'}`}>
                  {dl < 0 ? 'overdue' : dl === 0 ? 'today' : `${dl}d left`}
                </span>
              )}
              <button onClick={() => deleteDeadline(d.id).then(load)} className="text-slate-300 hover:text-red-500">✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
