import { useEffect, useState } from 'react'
import { addCaseEvent, caseAnalytics, createCase, getCase, listCases, updateCase } from '../api/client.js'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import Icon from '../components/Icon.jsx'

const STATUSES = ['open', 'in_progress', 'filed', 'resolved', 'closed']
const STATUS_COLOR = {
  open: 'bg-slate-100 text-mute', in_progress: 'bg-amber-50 text-amber-600',
  filed: 'bg-blue-50 text-blue-600', resolved: 'bg-green-50 text-green-600',
  closed: 'bg-slate-100 text-slate-400',
}

export function CaseAnalyticsWidget() {
  const [data, setData] = useState(null)
  useEffect(() => { caseAnalytics().then(setData).catch(() => {}) }, [])
  if (!data) return null
  return (
    <section className="card p-5">
      <h3 className="font-bold" style={{ color: 'var(--navy)' }}><T>Case analytics</T></h3>
      <div className="mt-3 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xl font-extrabold" style={{ color: 'var(--navy)' }}>{data.total}</div>
          <div className="text-xs text-mute"><T>Total cases</T></div>
        </div>
        <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xl font-extrabold" style={{ color: 'var(--navy)' }}>{Math.round(data.resolution_rate * 100)}%</div>
          <div className="text-xs text-mute"><T>Resolved</T></div>
        </div>
      </div>
    </section>
  )
}

function CaseDetail({ id, onBack, onChange }) {
  const [c, setC] = useState(null)
  const [note, setNote] = useState('')
  const load = () => getCase(id).then(setC)
  useEffect(() => { load() }, [id])
  if (!c) return null

  const setStatus = async (status) => { await updateCase(id, { status }); load(); onChange?.() }
  const addNote = async () => { if (!note.trim()) return; await addCaseEvent(id, { kind: 'note', title: 'Note', body: note }); setNote(''); load() }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-mute">← <T>Back to cases</T></button>
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">{c.title}</h2>
          <span className={`chip ${STATUS_COLOR[c.status]}`}>{c.status}</span>
        </div>
        <p className="mt-1 text-sm text-mute">{c.category} · {c.priority} · {c.jurisdiction}</p>
        {c.summary && <p className="mt-2 text-sm text-ink">{c.summary}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`chip ${c.status === s ? 'bg-teal text-white' : 'bg-slate-100 text-mute'}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold" style={{ color: 'var(--navy)' }}><T>Timeline</T></h3>
        <div className="mt-3 space-y-3">
          {c.events.map((e) => (
            <div key={e.id} className="flex gap-3">
              <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100"><Icon name="clock" size={13} /></span>
              <div className="flex-1 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                <div className="text-sm font-medium text-ink">{e.title || e.kind}</div>
                {e.body && <div className="text-sm text-mute">{e.body}</div>}
                <div className="text-xs text-slate-400">{new Date(e.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className="field flex-1" placeholder="Add a note…" value={note}
            onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} />
          <button onClick={addNote} className="btn-primary">+</button>
        </div>
      </div>
    </div>
  )
}

export default function Cases() {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState({ title: '', category: 'wages', priority: 'medium', summary: '' })
  const [error, setError] = useState('')

  const load = () => listCases().then(setRows).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  async function add() {
    if (!form.title.trim()) return
    try { await createCase(form); setForm({ title: '', category: 'wages', priority: 'medium', summary: '' }); load() }
    catch (e) { setError(e.message) }
  }

  if (open) return <CaseDetail id={open} onBack={() => { setOpen(null); load() }} onChange={load} />

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>My cases</T></h1>
          <p className="text-mute"><T>Track complaints, evidence, deadlines and progress in one place.</T></p>
        </div>
        {error && <ErrorState message={error} />}

        <section className="card grid gap-3 p-5 sm:grid-cols-2">
          <input className="field sm:col-span-2" placeholder="Case title" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {['tenancy', 'employment', 'consumer', 'wages', 'other'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {['low', 'medium', 'high', 'urgent'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <textarea className="field sm:col-span-2" placeholder="Summary" value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          <button onClick={add} className="btn-primary sm:col-span-2">+ <T>New case</T></button>
        </section>

        <div className="space-y-2">
          {rows.length === 0 && <p className="text-mute"><T>No cases yet.</T></p>}
          {rows.map((c) => (
            <button key={c.id} onClick={() => setOpen(c.id)} className="card flex w-full items-center gap-3 p-4 text-left hover:shadow-md">
              <span className="icon-tile h-9 w-9"><Icon name="file" size={16} /></span>
              <div className="flex-1">
                <div className="font-semibold text-ink">{c.title}</div>
                <div className="text-xs text-mute">{c.category} · {c.priority}</div>
              </div>
              <span className={`chip ${STATUS_COLOR[c.status]}`}>{c.status}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5"><CaseAnalyticsWidget /></div>
    </div>
  )
}
