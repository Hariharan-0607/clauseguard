import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { makeLetter } from '../api/client.js'
import { LANGUAGES, aiLanguage } from '../i18n.js'
import { ErrorState, Spinner } from '../components/States.jsx'
import PrintHeader from '../components/PrintHeader.jsx'
import Icon from '../components/Icon.jsx'

const TYPES = [
  { key: 'negotiation', label: 'Negotiate', hint: 'before signing' },
  { key: 'response', label: 'Object', hint: 'formal response' },
  { key: 'complaint', label: 'Complain', hint: 'to authority' }
]

export default function Letter() {
  const { id } = useParams()
  const [type, setType] = useState('complaint')
  const [language, setLanguage] = useState('en')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function generate() {
    setBusy(true); setError('')
    try {
      const res = await makeLetter({ analysisId: id, letterType: type, language: aiLanguage(language) })
      setText(res.text)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  function download() {
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `clauseguard-${type}-letter.txt`; a.click()
  }
  function copy() { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }

  return (
    <div className="space-y-5">
      <PrintHeader title="Formal letter" />
      <Link to={`/result/${id}`} className="text-sm font-medium text-mute hover:text-ink no-print">← Back to analysis</Link>
      <div className="no-print">
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}>Generate your letter</h1>
        <p className="mt-1.5 text-sm text-mute">AI drafts a ready-to-send letter citing the flagged clauses. Edit anything before you use it.</p>
      </div>

      {error && <ErrorState message={error} onRetry={generate} />}

      <section className="card p-5 no-print">
        <p className="label">Choose a tone</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {TYPES.map((tp) => (
            <button key={tp.key} onClick={() => setType(tp.key)}
              className="rounded-lg border p-4 text-left transition"
              style={type === tp.key
                ? { borderColor: 'var(--brand)', background: 'var(--brand-50)' }
                : { borderColor: 'var(--line)' }}>
              <div className="font-semibold" style={{ color: 'var(--navy)' }}>{tp.label}</div>
              <div className="text-xs text-mute">{tp.hint}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="field w-44">
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <button onClick={generate} disabled={busy} className="btn-primary">
            {busy ? <><Spinner /> Writing…</> : 'Write my letter'}
          </button>
        </div>
      </section>

      {text && (
        <>
          <section className="card animate-fade-up p-5 no-print">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={16}
              className="field font-mono text-sm leading-relaxed" />
            <div className="mt-3 flex gap-2">
              <button onClick={copy} className="btn-ghost">{copied ? 'Copied' : 'Copy'}</button>
              <button onClick={download} className="btn-ghost">Download</button>
              <button onClick={() => window.print()} className="btn-ghost"><Icon name="print" size={16} /> Export PDF</button>
            </div>
          </section>
          {/* print-only clean rendition of the letter */}
          <pre className="print-only whitespace-pre-wrap font-serif text-sm leading-relaxed" style={{ color: '#0f172a' }}>{text}</pre>
        </>
      )}
    </div>
  )
}
