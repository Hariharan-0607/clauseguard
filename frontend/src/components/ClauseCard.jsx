import { useState } from 'react'
import Icon from './Icon.jsx'
import { speak } from '../voice.js'
import { clauseMessage } from '../api/client.js'

const VERDICT = {
  illegal: { color: '#E11D48', soft: '#FEF2F2', edge: '#E11D48', label: 'Illegal' },
  unfair: { color: '#D97706', soft: '#FFFBEB', edge: '#F59E0B', label: 'Unfair' },
  fair: { color: '#0EA5A0', soft: '#E6F7F5', edge: '#0EA5A0', label: 'Fair' }
}

export default function ClauseCard({ clause, index, langCode = 'en', analysisId, language = 'English' }) {
  const v = VERDICT[clause.verdict] || VERDICT.fair
  const [noVoice, setNoVoice] = useState(false)
  const [msg, setMsg] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftErr, setDraftErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [fixCopied, setFixCopied] = useState(false)
  const flagged = clause.verdict === 'illegal' || clause.verdict === 'unfair'

  function read() {
    const r = speak(clause.explanation, langCode)
    setNoVoice(r.reason === 'no-voice')
  }

  async function draft() {
    if (!analysisId) return
    setDrafting(true); setDraftErr('')
    try {
      const r = await clauseMessage({ analysis_id: analysisId, clause_order: clause.order, language })
      setMsg(r.message)
    } catch (e) {
      setDraftErr(e.message || 'Could not draft a message.')
    } finally {
      setDrafting(false)
    }
  }

  function copyMsg() {
    navigator.clipboard.writeText(msg).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }
  function copyFix() {
    navigator.clipboard.writeText(clause.suggestion).then(() => { setFixCopied(true); setTimeout(() => setFixCopied(false), 1500) })
  }
  return (
    <div className="card animate-fade-up p-5" style={{ animationDelay: `${index * 50}ms`, borderLeft: `3px solid ${v.edge}` }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="chip" style={{ background: v.soft, color: v.color }}>{v.label}</span>
        <button onClick={read}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-mute hover:text-ink"
          title={noVoice ? 'No voice for this language on your device' : ''}>
          <Icon name="volume" size={14} /> {noVoice ? 'No voice on device' : 'Read aloud'}
        </button>
      </div>

      <p className="border-l-2 pl-3 text-sm italic text-mute" style={{ borderColor: 'var(--line)' }}>“{clause.original}”</p>
      <p className="mt-3 font-medium" style={{ color: 'var(--ink)' }}>{clause.explanation}</p>

      {clause.reason && (
        <p className="mt-2 text-sm" style={{ color: 'var(--text-2)' }}><span className="font-semibold" style={{ color: 'var(--text)' }}>Why: </span>{clause.reason}</p>
      )}
      {clause.citation && (
        <div className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--highlight)', color: 'var(--text-3)' }}>
          <Icon name="file" size={14} className="mt-px shrink-0" /><span>{clause.citation}</span>
        </div>
      )}
      {clause.suggestion && (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: '#A7F3D0', background: '#E6F7F5' }}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: '#0F766E' }}>
              <Icon name="pen" size={13} /> Fairer wording — use this instead
            </span>
            <button onClick={copyFix} className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: '#0F766E' }}>
              <Icon name="copy" size={13} /> {fixCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-sm" style={{ color: '#0F766E' }}>{clause.suggestion}</p>
        </div>
      )}

      {flagged && analysisId && (
        <div className="mt-3">
          {!msg && (
            <button onClick={draft} disabled={drafting}
              className="btn-ghost text-xs disabled:opacity-50">
              <Icon name="pen" size={14} /> {drafting ? 'Drafting…' : 'Draft a message'}
            </button>
          )}
          {draftErr && <p className="mt-2 text-xs" style={{ color: '#E11D48' }}>{draftErr}</p>}
          {msg && (
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--line)', background: 'var(--highlight)' }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-mute">Message to the other party</span>
                <button onClick={copyMsg} className="inline-flex items-center gap-1 text-xs font-medium text-mute hover:text-ink">
                  <Icon name="copy" size={13} /> {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text)' }}>{msg}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
