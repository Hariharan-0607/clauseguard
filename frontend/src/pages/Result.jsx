import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAnalysis, fileReport, redraftAnalysis } from '../api/client.js'
import RiskBadge from '../components/RiskBadge.jsx'
import ClauseCard from '../components/ClauseCard.jsx'
import { ErrorState } from '../components/States.jsx'
import { resolveCode } from '../i18n.js'
import { speak } from '../voice.js'
import Icon from '../components/Icon.jsx'
import PrintHeader from '../components/PrintHeader.jsx'

export default function Result() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [reported, setReported] = useState(false)
  const [copied, setCopied] = useState(false)
  const [redraft, setRedraft] = useState(null)
  const [redrafting, setRedrafting] = useState(false)
  const [redraftErr, setRedraftErr] = useState('')
  const [draftCopied, setDraftCopied] = useState(false)

  const load = () => { setError(''); getAnalysis(id).then(setData).catch((e) => setError(e.message)) }
  useEffect(load, [id])

  const langCode = data ? resolveCode(data.language) : 'en'

  const [voiceMsg, setVoiceMsg] = useState('')
  function speakSummary() {
    if (!data) return
    const r = speak(data.summary, langCode)
    setVoiceMsg(r.reason === 'no-voice' ? 'No voice for this language is installed on your device.' : '')
  }
  async function report() {
    navigator.geolocation?.getCurrentPosition(
      (p) => fileReport(id, p.coords.latitude, p.coords.longitude).then(() => setReported(true)),
      () => fileReport(id).then(() => setReported(true))
    )
  }
  function share() {
    const url = window.location.href
    if (navigator.share) navigator.share({ title: 'ClauseGuard analysis', url })
    else navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }
  async function makeRedraft() {
    setRedrafting(true); setRedraftErr('')
    try {
      const r = await redraftAnalysis(id, data.language)
      setRedraft(r)
      setTimeout(() => document.getElementById('redraft-card')?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e) { setRedraftErr(e.message || 'Could not redraft the contract.') }
    finally { setRedrafting(false) }
  }
  function copyRedraft() {
    navigator.clipboard.writeText(redraft.text).then(() => { setDraftCopied(true); setTimeout(() => setDraftCopied(false), 1500) })
  }

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!data) return <Skeleton />

  const counts = data.clauses.reduce((a, c) => ((a[c.verdict] = (a[c.verdict] || 0) + 1), a), {})

  const TOP = { red: '#E11D48', amber: '#D97706', green: 'var(--teal)' }

  return (
    <div className="space-y-6">
      <PrintHeader title={data.title} />
      <Link to="/check" className="inline-flex items-center gap-1.5 text-sm font-medium text-mute hover:text-ink no-print">
        <Icon name="arrow" size={15} className="rotate-180" /> New check
      </Link>

      {/* RISK HERO */}
      <section className="card animate-fade-up overflow-hidden">
        <div className="h-1" style={{ background: TOP[data.risk_level] }} />
        <div className="p-6">
          <div className="flex items-center justify-between">
            <RiskBadge level={data.risk_level} score={data.risk_score} />
            <button onClick={speakSummary} className="inline-flex items-center gap-1.5 text-sm font-medium text-mute hover:text-ink">
              <Icon name="volume" size={16} /> Read aloud
            </button>
          </div>
          {voiceMsg && <p className="mt-2 text-xs" style={{ color: '#D97706' }}>{voiceMsg}</p>}
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-mute">Bottom line</p>
          <p className="mt-1.5 text-lg font-semibold leading-snug" style={{ color: 'var(--navy)' }}>{data.summary}</p>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat n={counts.illegal || 0} label="Illegal" color="#E11D48" />
            <Stat n={counts.unfair || 0} label="Unfair" color="#D97706" />
            <Stat n={counts.fair || 0} label="Fair" color="#0EA5A0" />
          </div>

          <div className="mt-5 flex flex-wrap gap-2 no-print">
            <Link to={`/letter/${id}`} className="btn-primary"><Icon name="pen" size={16} /> Generate a letter</Link>
            {(counts.illegal || counts.unfair) ? (
              <button onClick={makeRedraft} disabled={redrafting} className="btn-ghost disabled:opacity-50">
                <Icon name="file" size={16} /> {redrafting ? 'Redrafting…' : redraft ? 'Redraft again' : 'Redraft a fair version'}
              </button>
            ) : null}
            <button onClick={() => window.print()} className="btn-ghost"><Icon name="print" size={16} /> Export PDF</button>
            <button onClick={share} className="btn-ghost"><Icon name="share" size={16} /> {copied ? 'Copied' : 'Share'}</button>
            <button onClick={report} disabled={reported} className="btn-ghost disabled:opacity-50">
              <Icon name="flag" size={16} /> {reported ? 'Reported' : 'Report'}
            </button>
          </div>
        </div>
      </section>

      {redraftErr && <ErrorState message={redraftErr} onRetry={makeRedraft} />}

      {redraft && (
        <section id="redraft-card" className="card animate-fade-up p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--teal)' }}>Fair redraft</p>
              <h2 className="mt-0.5 text-lg font-bold" style={{ color: 'var(--text)' }}>A balanced version of this contract</h2>
            </div>
            <div className="flex gap-2 no-print">
              <button onClick={copyRedraft} className="btn-ghost text-sm"><Icon name="copy" size={15} /> {draftCopied ? 'Copied' : 'Copy'}</button>
              <button onClick={() => window.print()} className="btn-ghost text-sm"><Icon name="print" size={15} /> Export PDF</button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap rounded-lg border p-4 text-sm leading-relaxed"
            style={{ borderColor: 'var(--line)', background: 'var(--highlight)', color: 'var(--text)', fontFamily: 'inherit' }}>{redraft.text}</pre>
          <p className="mt-3 text-xs" style={{ color: 'var(--text-3)' }}>
            AI-generated fair draft — not legal advice. Have it reviewed before signing.
          </p>
        </section>
      )}

      <div>
        <p className="label">Clause-by-clause breakdown</p>
        <div className="space-y-3">
          {data.clauses.map((c, i) => <ClauseCard key={c.order} clause={c} index={i} langCode={langCode} analysisId={id} language={data.language} />)}
        </div>
      </div>
    </div>
  )
}

function Stat({ n, label, color }) {
  return (
    <div className="rounded-xl border p-3 text-center" style={{ borderColor: 'var(--line)' }}>
      <div className="text-2xl font-extrabold" style={{ color: n ? color : '#CBD5E1' }}>{n}</div>
      <div className="text-xs font-medium text-mute">{label}</div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-44 rounded-xl2" />
      {[0, 1, 2].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
      <p className="text-center text-sm text-mute">AI is reading your contract…</p>
    </div>
  )
}
