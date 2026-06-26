import { useRef, useState } from 'react'
import { compareContracts, extractFile } from '../api/client.js'
import { LANGUAGES, aiLanguage } from '../i18n.js'
import { ErrorState, Spinner } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useUI } from '../ui.jsx'
import Icon from '../components/Icon.jsx'

const RISK = {
  red: { label: 'High risk', color: '#E11D48', bg: '#FEF2F2' },
  amber: { label: 'Some risk', color: '#D97706', bg: '#FFFBEB' },
  green: { label: 'Low risk', color: '#0EA5A0', bg: '#E6F7F5' }
}

export default function Compare() {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [labelA, setLabelA] = useState('Offer A')
  const [labelB, setLabelB] = useState('Offer B')
  const [language, setLanguage] = useState('en')
  const [jurisdiction, setJurisdiction] = useState('IN')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  useUI().version

  const canSubmit = a.trim().length > 15 && b.trim().length > 15 && !busy

  async function run() {
    setError(''); setBusy(true); setResult(null)
    try {
      const res = await compareContracts({
        text_a: a, text_b: b, label_a: labelA || 'Offer A', label_b: labelB || 'Offer B',
        jurisdiction, language: aiLanguage(language)
      })
      setResult(res)
    } catch (e) { setError(e.message || 'Something went wrong.') } finally { setBusy(false) }
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}><T>Side by side</T></p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}><T>Compare two contracts</T></h1>
        <p className="mt-2 max-w-2xl" style={{ color: 'var(--text-3)' }}>
          <T>Paste two offers, leases, or agreements. ClauseGuard tells you which is safer and what’s different.</T>
        </p>
      </div>

      {error && <ErrorState message={error} />}

      <div className="grid gap-5 lg:grid-cols-2">
        <Pane label={labelA} setLabel={setLabelA} text={a} setText={setA} onError={setError} placeholder="Paste the first contract, or upload a file…" />
        <Pane label={labelB} setLabel={setLabelB} text={b} setText={setB} onError={setError} placeholder="Paste the second contract, or upload a file…" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="field w-44">
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className="field w-44">
          <option value="IN">India</option>
          <option value="US-CA">USA — California</option>
        </select>
        <button onClick={run} disabled={!canSubmit} className="btn-primary px-5 py-2.5 disabled:opacity-60">
          {busy ? <><Spinner /> <T>Comparing…</T></> : <><Icon name="compare" size={16} /> <T>Compare</T></>}
        </button>
      </div>

      {busy && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      )}

      {result && <Outcome result={result} />}

      <p className="text-center text-xs" style={{ color: 'var(--text-3)' }}>
        <T>ClauseGuard gives general guidance, not legal advice. For your specific case, consult a qualified lawyer or free legal aid.</T>
      </p>
    </div>
  )
}

function Pane({ label, setLabel, text, setText, onError, placeholder }) {
  const inputRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)

  async function ingest(file) {
    if (!file) return
    setReading(true); onError?.('')
    try {
      const { text: extracted } = await extractFile(file)
      setText(extracted); setFileName(file.name)
    } catch (e) {
      onError?.(`${file.name}: ${e.message || 'Could not read that file.'}`)
    } finally {
      setReading(false)
    }
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false)
    ingest(e.dataTransfer.files?.[0])
  }

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: dragging ? 'var(--accent)' : 'var(--border)', background: 'var(--card)' }}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5" style={{ borderColor: 'var(--border)' }}>
        <input value={label} onChange={(e) => setLabel(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" style={{ color: 'var(--text)' }} />
        <input ref={inputRef} type="file" accept="image/*,application/pdf,.txt" className="hidden"
          onChange={(e) => ingest(e.target.files?.[0])} />
        <button onClick={() => inputRef.current?.click()} disabled={reading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50"
          style={{ color: 'var(--accent)' }}>
          {reading ? <><Spinner /> <T>Reading…</T></> : <><Icon name="download" size={13} /> <T>Upload file</T></>}
        </button>
      </div>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setFileName('') }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)} onDrop={onDrop}
        placeholder={placeholder}
        className="min-h-[260px] w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed outline-none"
        style={{ color: 'var(--text)' }} />
      <div className="border-t px-4 py-2 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
        {fileName
          ? <span className="inline-flex items-center gap-1.5"><Icon name="file" size={12} /> {fileName}</span>
          : <T>Paste text, drag &amp; drop, or upload a PDF / photo / scan</T>}
      </div>
    </div>
  )
}

function Outcome({ result }) {
  const saferLabel = result.safer === 'A' ? result.a.label : result.safer === 'B' ? result.b.label : null
  return (
    <div className="animate-fade-up space-y-5">
      {/* verdict banner */}
      <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--highlight)' }}>
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--card)', color: 'var(--accent)' }}>
            <Icon name="shield" size={18} />
          </span>
          <div>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>
              {saferLabel ? <><T>Safer choice</T>: {saferLabel}</> : <T>Both are similar in risk</T>}
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>{result.verdict}</p>
          </div>
        </div>
      </div>

      {/* side-by-side risk */}
      <div className="grid gap-5 lg:grid-cols-2">
        <SideCard side={result.a} safe={result.safer === 'A'} />
        <SideCard side={result.b} safe={result.safer === 'B'} />
      </div>

      {/* differences */}
      {result.differences?.length > 0 && (
        <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: 'var(--highlight)', color: 'var(--accent)' }}>
              <Icon name="compare" size={15} />
            </span>
            <h3 className="font-semibold" style={{ color: 'var(--text)' }}><T>Key differences</T></h3>
          </div>
          <ul className="space-y-2">
            {result.differences.map((d, i) => (
              <li key={i} className="flex items-start gap-2" style={{ color: 'var(--text-2)' }}>
                <Icon name="arrow" size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} /><span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SideCard({ side, safe }) {
  const r = RISK[side.risk_level] || RISK.amber
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: safe ? 'var(--teal)' : 'var(--border)', background: 'var(--card)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>{side.label}</h3>
        {safe && <span className="chip" style={{ background: '#E6F7F5', color: '#0F766E' }}><T>Safer</T></span>}
      </div>
      <div className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: r.bg, color: r.color }}>
        <span className="text-sm font-bold">{r.label}</span>
        <span className="text-xs opacity-80">· {Math.round(side.risk_score)}/100</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Mini n={side.counts.illegal || 0} label="Illegal" color="#E11D48" />
        <Mini n={side.counts.unfair || 0} label="Unfair" color="#D97706" />
        <Mini n={side.counts.fair || 0} label="Fair" color="#0EA5A0" />
      </div>
      <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{side.summary}</p>
    </div>
  )
}

function Mini({ n, label, color }) {
  return (
    <div className="rounded-lg border p-2 text-center" style={{ borderColor: 'var(--border)' }}>
      <div className="text-lg font-extrabold" style={{ color: n ? color : '#CBD5E1' }}>{n}</div>
      <div className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>{label}</div>
    </div>
  )
}
