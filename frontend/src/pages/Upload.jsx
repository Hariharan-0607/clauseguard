import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeFile, analyzeText } from '../api/client.js'
import { LANGUAGES, aiLanguage } from '../i18n.js'
import { SAMPLES } from '../samples.js'
import { startDictation, speechSupported } from '../voice.js'
import { ErrorState, Spinner } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useUI } from '../ui.jsx'
import Icon from '../components/Icon.jsx'

export default function Upload() {
  const nav = useNavigate()
  const [tab, setTab] = useState('paste')          // 'paste' | 'upload'
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [language, setLanguage] = useState('en')
  const [jurisdiction, setJurisdiction] = useState('IN')
  const [counterparty, setCounterparty] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')

  const stats = useMemo(() => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const clauses = (text.match(/(?:^|\n)\s*(?:\(?\d{1,2}[.)]|clause|section)/gi) || []).length
    return { words, chars: text.length, clauses }
  }, [text])

  function loadSample(sample) {
    setTab('paste'); setText(sample.text); setJurisdiction(sample.jurisdiction)
    setCounterparty(sample.counterparty); setFile(null); setError('')
  }

  function startVoice() {
    setError('')
    startDictation({
      langCode: language,
      onResult: (t) => setText((prev) => (prev ? prev + ' ' : '') + t),
      onError: setError, onState: setListening
    })
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) { setFile(f); setTab('upload') }
  }

  async function submit() {
    setError(''); setBusy(true)
    try {
      const payload = { language: aiLanguage(language), jurisdiction, counterparty }
      const result = (tab === 'upload' && file)
        ? await analyzeFile({ file, ...payload })
        : await analyzeText({ text, ...payload })
      nav(`/result/${result.id}`)
    } catch (e) { setError(e.message || 'Something went wrong.') } finally { setBusy(false) }
  }

  const canSubmit = ((tab === 'paste' && text.trim().length > 15) || (tab === 'upload' && file)) && !busy

  useUI().version  // re-render when translations arrive

  return (
    <div className="animate-fade-up">
      {/* Page heading + step indicator */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}><T>Contract review</T></p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}><T>New analysis</T></h1>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-3)' }}>
          <Step n="1" label={<T>Add document</T>} active />
          <span style={{ color: 'var(--border)' }}>→</span>
          <Step n="2" label={<T>Review settings</T>} />
          <span style={{ color: 'var(--border)' }}>→</span>
          <Step n="3" label={<T>Get results</T>} />
        </div>
      </div>

      {error && <div className="mb-5"><ErrorState message={error} /></div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* LEFT: document workspace */}
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          {/* tab bar */}
          <div className="flex items-center justify-between border-b px-2" style={{ borderColor: 'var(--border)' }}>
            <div className="flex">
              <TabBtn active={tab === 'paste'} onClick={() => setTab('paste')} icon="file" label={<T>Paste text</T>} />
              <TabBtn active={tab === 'upload'} onClick={() => setTab('upload')} icon="search" label={<T>Upload file</T>} />
            </div>
            {tab === 'paste' && speechSupported() && (
              <button onClick={startVoice}
                className="mr-2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium"
                style={{ color: listening ? '#E11D48' : 'var(--accent)', background: listening ? '#FEF2F2' : 'transparent' }}>
                <Icon name="volume" size={13} />{listening ? 'Listening…' : 'Dictate'}
              </button>
            )}
          </div>

          {/* editor / dropzone */}
          {tab === 'paste' ? (
            <div className="flex min-h-[420px] flex-col">
              <textarea value={text} onChange={(e) => setText(e.target.value)}
                placeholder="Paste your rental agreement, job offer, or any contract here…&#10;&#10;ClauseGuard reads it clause by clause."
                className="flex-1 resize-none bg-transparent px-6 py-5 text-[15px] leading-relaxed outline-none"
                style={{ color: 'var(--text)', minHeight: 380 }} />
              {/* status bar */}
              <div className="flex items-center justify-between border-t px-6 py-2.5 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                <span>{stats.words} words · {stats.clauses || '—'} clauses detected</span>
                {text && <button onClick={() => setText('')} className="font-medium hover:underline">Clear</button>}
              </div>
            </div>
          ) : (
            <label onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)} onDrop={onDrop}
              className="flex min-h-[420px] cursor-pointer flex-col items-center justify-center px-6 text-center transition"
              style={{ background: dragging ? 'var(--highlight)' : 'transparent' }}>
              <input type="file" accept="image/*,application/pdf,.txt" className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <span className="grid h-16 w-16 place-items-center rounded-2xl" style={{ background: 'var(--highlight)', color: 'var(--accent)' }}>
                <Icon name="file" size={28} />
              </span>
              {file ? (
                <>
                  <p className="mt-4 font-semibold" style={{ color: 'var(--text)' }}>{file.name}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>{(file.size / 1024).toFixed(0)} KB · click to replace</p>
                </>
              ) : (
                <>
                  <p className="mt-4 font-semibold" style={{ color: 'var(--text)' }}>Drag &amp; drop a contract</p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>or click to browse — photo, scan, or PDF</p>
                </>
              )}
            </label>
          )}
        </div>

        {/* RIGHT: settings rail */}
        <aside className="space-y-5">
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            {/* card header */}
            <div className="flex items-center gap-2.5 border-b px-5 py-3.5" style={{ borderColor: 'var(--border)' }}>
              <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: 'var(--highlight)', color: 'var(--accent)' }}>
                <Icon name="scale" size={15} />
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}><T>Review settings</T></span>
            </div>

            <div className="space-y-4 p-5">
              <Field label={<T>Explain results in</T>}>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="field">
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </Field>
              <Field label={<T>Jurisdiction</T>}>
                <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className="field">
                  <option value="IN">India</option>
                  <option value="US-CA">USA — California</option>
                </select>
              </Field>
              <Field label={<><T>Other party</T> <span style={{ color: 'var(--text-3)' }}>· <T>optional</T></span></>} icon="user">
                <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)}
                  placeholder="Landlord / employer name" className="field pl-9" />
              </Field>

              <button onClick={submit} disabled={!canSubmit}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold transition disabled:cursor-not-allowed"
                style={canSubmit
                  ? { background: 'var(--primary)', color: 'var(--text-inv)' }
                  : { background: 'var(--highlight)', color: 'var(--text-3)' }}>
                {busy ? <><Spinner /> <T>Analysing…</T></> : <><T>Analyse contract</T> <Icon name="arrow" size={17} /></>}
              </button>

              {!canSubmit && !busy && (
                <p className="text-center text-xs" style={{ color: 'var(--text-3)' }}>
                  <T>{tab === 'upload' ? 'Choose a file to continue' : 'Add some contract text to continue'}</T>
                </p>
              )}

              <div className="flex items-center justify-center gap-1.5 border-t pt-3.5 text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                <Icon name="shield" size={12} />
                <span><T>Processed privately · never sold · not legal advice</T></span>
              </div>
            </div>
          </div>

          {/* samples */}
          <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <p className="label"><T>Or load an example</T></p>
            <div className="space-y-2">
              {SAMPLES.map((sp) => (
                <button key={sp.id} onClick={() => loadSample(sp)}
                  className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition hover:border-[var(--accent)]"
                  style={{ borderColor: 'var(--border)' }}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md" style={{ background: 'var(--highlight)', color: 'var(--accent)' }}>
                    <Icon name="file" size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium" style={{ color: 'var(--text)' }}>{sp.label}</span>
                    <span className="block text-xs" style={{ color: 'var(--text-3)' }}>{sp.kind} · {sp.jurisdiction}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, icon, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{label}</label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 z-10" style={{ color: 'var(--text-3)' }}>
            <Icon name={icon} size={15} />
          </span>
        )}
        {children}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick}
      className="relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition"
      style={{ color: active ? 'var(--text)' : 'var(--text-3)' }}>
      <Icon name={icon} size={15} /> {label}
      {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full" style={{ background: 'var(--primary)' }} />}
    </button>
  )
}

function Step({ n, label, active }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold"
        style={active ? { background: 'var(--primary)', color: 'var(--text-inv)' } : { background: 'var(--highlight)', color: 'var(--text-3)' }}>{n}</span>
      <span style={{ color: active ? 'var(--text)' : 'var(--text-3)' }}>{label}</span>
    </span>
  )
}
