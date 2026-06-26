import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { askChat } from '../api/client.js'
import { aiLanguage } from '../i18n.js'
import { useUI } from '../ui.jsx'
import { speak, startDictation, speechSupported, ttsSupported } from '../voice.js'
import Icon from './Icon.jsx'

const PAGE_NAMES = {
  '/': 'Home', '/check': 'Check a contract', '/result': 'Contract analysis',
  '/letter': 'Letter generator', '/library': 'Rights library', '/chat': 'Assistant',
  '/map': 'Offender map', '/deadlines': 'Deadline tracker', '/help': 'Legal-aid directory',
  '/history': 'History'
}

function pageName(path) {
  const key = Object.keys(PAGE_NAMES).find((k) => k !== '/' && path.startsWith(k))
  return PAGE_NAMES[key] || PAGE_NAMES[path] || 'ClauseGuard'
}

// Grab the visible text of the main content area (what the user is looking at).
function readPage() {
  const main = document.querySelector('main') || document.body
  const text = (main.innerText || '').replace(/\s+\n/g, '\n').trim()
  return text.slice(0, 4000)
}

export default function AssistantWidget() {
  const { pathname } = useLocation()
  const { lang } = useUI()
  const [open, setOpen] = useState(false)
  const [jurisdiction, setJurisdiction] = useState('IN')
  const [listening, setListening] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hi! I can answer questions about your rights — or about whatever is on this page. Ask me anything.' }
  ])
  const endRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (open) setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [open, messages])

  // close on Escape
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function send(q) {
    const question = (q ?? input).trim()
    if (!question || busy) return
    setMessages((m) => [...m, { role: 'me', text: question }])
    setInput(''); setBusy(true)
    try {
      const res = await askChat({
        question, jurisdiction, language: aiLanguage(lang),
        page_context: readPage(), page_name: pageName(pathname)
      })
      setMessages((m) => [...m, { role: 'ai', text: res.answer }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: e.message, error: true }])
    } finally { setBusy(false) }
  }

  function dictate() {
    startDictation({
      langCode: lang,
      onResult: (t) => setInput((p) => (p ? p + ' ' : '') + t),
      onError: (msg) => setMessages((m) => [...m, { role: 'ai', text: msg, error: true }]),
      onState: setListening
    })
  }

  const suggestions = [
    'Summarise this page for me',
    'Is anything here unfair to me?',
    'Explain my rights in simple words'
  ]

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen((o) => !o)} aria-label="Open assistant"
        className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full shadow-lg transition hover:scale-105"
        style={{ background: 'var(--primary)', color: 'var(--text-inv)' }}>
        <Icon name={open ? 'arrow' : 'chat'} size={24} className={open ? 'rotate-90' : ''} />
      </button>

      {/* Panel */}
      {open && (
        <div ref={panelRef}
          className="fixed bottom-24 right-5 z-50 flex max-h-[70vh] w-[min(92vw,380px)] flex-col rounded-2xl border shadow-2xl"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: 'var(--primary)', color: 'var(--text-inv)' }}>
                <Icon name="shield" size={15} />
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Assistant</p>
                <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Reading: {pageName(pathname)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}
                className="rounded-md border px-1.5 py-1 text-[11px]"
                style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value="IN">IN</option><option value="US-CA">CA</option>
              </select>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--text-3)' }}>✕</button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className="group max-w-[88%]">
                  <div className="rounded-2xl px-3 py-2 text-sm"
                    style={m.role === 'me'
                      ? { background: 'var(--primary)', color: 'var(--text-inv)' }
                      : m.error ? { background: '#FEF2F2', color: '#B91C1C' }
                        : { background: 'var(--highlight)', color: 'var(--text)' }}>
                    {m.text}
                  </div>
                  {m.role === 'ai' && !m.error && ttsSupported() && (
                    <button onClick={() => {
                      const r = speak(m.text, lang)
                      if (r.reason === 'no-voice') setMessages((ms) => [...ms, { role: 'ai', text: 'No voice for this language is installed on your device.', error: true }])
                    }}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] opacity-0 transition group-hover:opacity-100"
                      style={{ color: 'var(--text-3)' }}>
                      <Icon name="volume" size={11} /> Listen
                    </button>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="flex justify-start"><div className="rounded-2xl px-3 py-2 text-sm" style={{ background: 'var(--highlight)', color: 'var(--text-3)' }}>Thinking…</div></div>}
            <div ref={endRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-1">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="rounded-full border px-2.5 py-1 text-[11px]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t p-3" style={{ borderColor: 'var(--border)' }}>
            {speechSupported() && (
              <button onClick={dictate} title="Speak"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border"
                style={{ borderColor: 'var(--border)', color: listening ? '#E11D48' : 'var(--text-2)' }}>
                <Icon name="volume" size={16} />
              </button>
            )}
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={listening ? 'Listening…' : 'Ask about this page…'}
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            <button onClick={() => send()} disabled={busy}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
              style={{ background: 'var(--primary)', color: 'var(--text-inv)' }}>
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
