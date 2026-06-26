import { useState } from 'react'
import { Link } from 'react-router-dom'
import { advise, savePlan, addDeadline } from '../api/client.js'
import { useAuth } from '../auth.jsx'
import { LANGUAGES, aiLanguage } from '../i18n.js'
import { startDictation, speechSupported } from '../voice.js'
import { ErrorState, Spinner } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useUI } from '../ui.jsx'
import Icon from '../components/Icon.jsx'
import PrintHeader from '../components/PrintHeader.jsx'

const EXAMPLES = [
  'My landlord won’t return my security deposit after I moved out.',
  'I was fired without any notice or my final salary.',
  'A shop sold me a defective product and refuses to refund me.',
  'My employer is making me work overtime with no extra pay.'
]

const URGENCY = {
  high: { label: 'Act now', color: '#E11D48', bg: '#FEF2F2' },
  medium: { label: 'Act soon', color: '#D97706', bg: '#FFFBEB' },
  low: { label: 'No rush', color: '#0EA5A0', bg: '#E6F7F5' }
}

export default function Advisor() {
  const { lang } = useUI()
  useUI().version
  const [situation, setSituation] = useState('')
  const [jurisdiction, setJurisdiction] = useState('IN')
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState(null)

  function dictate() {
    setError('')
    startDictation({
      langCode: lang,
      onResult: (t) => setSituation((p) => (p ? p + ' ' : '') + t),
      onError: setError, onState: setListening
    })
  }

  async function ask(text) {
    const s = (text ?? situation).trim()
    if (s.length < 8) { setError('Please describe your situation in a sentence or two.'); return }
    if (text) setSituation(text)
    setBusy(true); setError(''); setPlan(null)
    try {
      const res = await advise({ situation: s, jurisdiction, language: aiLanguage(lang) })
      setPlan(res)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="no-print">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}><T>Legal advisor</T></p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}><T>Describe your problem</T></h1>
        <p className="mt-2 max-w-2xl" style={{ color: 'var(--text-3)' }}>
          <T>Tell us what’s happening in plain words. You’ll get your rights, what to do step by step, and where to find real help.</T>
        </p>
      </div>

      {/* Intake */}
      <div className="rounded-2xl border no-print" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="p-5">
          <div className="relative">
            <textarea value={situation} onChange={(e) => setSituation(e.target.value)} rows={4}
              placeholder="e.g. My landlord won’t return my deposit and says it’s non-refundable…"
              className="w-full resize-none rounded-xl border bg-transparent px-4 py-3 text-[15px] leading-relaxed outline-none"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }} />
            {speechSupported() && (
              <button onClick={dictate}
                className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
                style={{ color: listening ? '#E11D48' : 'var(--accent)' }}>
                <Icon name="volume" size={13} />{listening ? 'Listening…' : 'Speak'}
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className="field w-40">
              <option value="IN">India</option>
              <option value="US-CA">USA — California</option>
            </select>
            <button onClick={() => ask()} disabled={busy}
              className="btn-primary px-5 py-2.5">
              {busy ? <><Spinner /> <T>Thinking…</T></> : <><T>Get advice</T> <Icon name="arrow" size={16} /></>}
            </button>
          </div>
        </div>

        {!plan && !busy && (
          <div className="border-t px-5 py-4" style={{ borderColor: 'var(--border)' }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}><T>Common situations</T></p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => ask(ex)}
                  className="rounded-full border px-3 py-1.5 text-xs transition hover:border-[var(--accent)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>{ex}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={() => ask()} />}

      {busy && (
        <div className="space-y-3">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
          <p className="text-center text-sm" style={{ color: 'var(--text-3)' }}><T>Reading your situation and finding your rights…</T></p>
        </div>
      )}

      {plan && <Plan plan={plan} />}
    </div>
  )
}

function Plan({ plan }) {
  const u = URGENCY[plan.urgency] || URGENCY.medium
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actErr, setActErr] = useState('')
  const [showReminder, setShowReminder] = useState(false)
  const [date, setDate] = useState('')
  const [reminded, setReminded] = useState(false)

  async function save() {
    setSaving(true); setActErr('')
    try { await savePlan(plan); setSaved(true) }
    catch (e) { setActErr(e.message || 'Could not save the plan.') }
    finally { setSaving(false) }
  }

  async function addReminder() {
    if (!date) return
    setActErr('')
    try {
      await addDeadline({ title: plan.title, kind: 'notice', due_date: date, notes: plan.deadline_note || '' })
      setReminded(true); setShowReminder(false)
    } catch (e) { setActErr(e.message || 'Could not add the reminder.') }
  }

  return (
    <div className="animate-fade-up space-y-5">
      <PrintHeader title={plan.title} />
      {/* summary card */}
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="flex items-start justify-between gap-3 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>{plan.category}</p>
            <h2 className="mt-1 text-xl font-bold" style={{ color: 'var(--text)' }}>{plan.title}</h2>
            <p className="mt-2 leading-relaxed" style={{ color: 'var(--text-2)' }}>{plan.summary}</p>
          </div>
          <span className="chip shrink-0" style={{ background: u.bg, color: u.color }}>{u.label}</span>
        </div>
        {plan.deadline_note && (
          <div className="flex items-center gap-2 border-t px-5 py-3 text-sm" style={{ borderColor: 'var(--border)', color: u.color, background: u.bg }}>
            <Icon name="clock" size={15} /> <span>{plan.deadline_note}</span>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* steps (primary) */}
        <Section icon="check" title="What to do" className="lg:row-span-2">
          <ol className="space-y-3">
            {plan.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--primary)', color: 'var(--text-inv)' }}>{i + 1}</span>
                <span className="leading-relaxed" style={{ color: 'var(--text-2)' }}>{s}</span>
              </li>
            ))}
          </ol>
        </Section>

        {/* rights */}
        <Section icon="scale" title="Your rights">
          <ul className="space-y-2">
            {plan.rights.map((r, i) => (
              <li key={i} className="flex items-start gap-2" style={{ color: 'var(--text-2)' }}>
                <Icon name="check" size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--teal)' }} /><span>{r}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* documents */}
        <Section icon="file" title="Documents to prepare">
          <ul className="space-y-2">
            {plan.documents.map((d, i) => (
              <li key={i} className="flex items-start gap-2" style={{ color: 'var(--text-2)' }}>
                <Icon name="file" size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--text-3)' }} /><span>{d}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* help + actions */}
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--highlight)' }}>
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--card)', color: 'var(--accent)' }}>
            <Icon name="help" size={18} />
          </span>
          <div>
            <p className="font-semibold" style={{ color: 'var(--text)' }}><T>Where to get real help</T></p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>{plan.help}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {user && (
            <>
              <button onClick={save} disabled={saving || saved} className="btn-primary px-3 py-2 text-sm disabled:opacity-60">
                <Icon name="save" size={15} /> {saved ? <T>Saved to history</T> : saving ? <T>Saving…</T> : <T>Save plan</T>}
              </button>
              <button onClick={() => setShowReminder((s) => !s)} disabled={reminded} className="btn-ghost px-3 py-2 text-sm disabled:opacity-60">
                <Icon name="calendar" size={15} /> {reminded ? <T>Reminder added</T> : <T>Add a reminder</T>}
              </button>
            </>
          )}
          <button onClick={() => window.print()} className="btn-ghost px-3 py-2 text-sm no-print">
            <Icon name="print" size={15} /> <T>Export PDF</T>
          </button>
          <Link to="/help" className="btn-ghost px-3 py-2 text-sm"><T>Find legal aid near me</T></Link>
          <Link to="/check" className="btn-ghost px-3 py-2 text-sm"><T>Check a related contract</T></Link>
        </div>
        {showReminder && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field w-44" />
            <button onClick={addReminder} disabled={!date} className="btn-primary px-3 py-2 text-sm disabled:opacity-50">
              <T>Set reminder</T>
            </button>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}><T>We’ll add it to your deadlines.</T></span>
          </div>
        )}
        {actErr && <p className="mt-2 text-xs" style={{ color: '#E11D48' }}>{actErr}</p>}
      </div>

      <p className="text-center text-xs" style={{ color: 'var(--text-3)' }}>
        <T>ClauseGuard gives general guidance, not legal advice. For your specific case, consult a qualified lawyer or free legal aid.</T>
      </p>
    </div>
  )
}

function Section({ icon, title, children, className = '' }) {
  return (
    <div className={`rounded-2xl border p-5 ${className}`} style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: 'var(--highlight)', color: 'var(--accent)' }}>
          <Icon name={icon} size={15} />
        </span>
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}><T>{title}</T></h3>
      </div>
      {children}
    </div>
  )
}
