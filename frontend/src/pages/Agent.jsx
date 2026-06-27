import { useEffect, useRef, useState } from 'react'
import { addMemory, agentChat, deleteMemory, listMemories } from '../api/client.js'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useT } from '../ui.jsx'
import Icon from '../components/Icon.jsx'

function Memories() {
  const tr = useT()
  const [mems, setMems] = useState([])
  const [text, setText] = useState('')
  const load = () => listMemories().then(setMems).catch(() => {})
  useEffect(() => { load() }, [])
  const add = async () => { if (!text.trim()) return; await addMemory({ content: text, kind: 'fact' }); setText(''); load() }
  const remove = async (id) => { await deleteMemory(id); load() }
  return (
    <section className="card p-5">
      <h3 className="font-bold" style={{ color: 'var(--navy)' }}><T>What the agent remembers</T></h3>
      <div className="mt-3 flex gap-2">
        <input className="field flex-1" placeholder={tr('Tell the agent a fact…')} value={text}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button onClick={add} className="btn-primary">+</button>
      </div>
      <div className="mt-3 space-y-2">
        {mems.length === 0 && <p className="text-sm text-mute"><T>No memories yet — they build up as you use JusticeAI.</T></p>}
        {mems.map((m) => (
          <div key={m.id} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-sm">
            <span className="flex-1 text-ink">{m.content}<span className="ml-1 text-xs text-slate-400">({m.kind})</span></span>
            <button onClick={() => remove(m.id)} className="text-slate-300 hover:text-red-500">✕</button>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Agent() {
  const tr = useT()
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send() {
    if (!input.trim() || loading) return
    const message = input
    setMsgs((m) => [...m, { role: 'user', content: message }])
    setInput(''); setLoading(true); setError('')
    try {
      const r = await agentChat({ message, jurisdiction: 'IN', language: 'en' })
      setMsgs((m) => [...m, { role: 'assistant', content: r.answer }])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Personal legal agent</T></h1>
          <p className="text-mute"><T>Your assistant that remembers your situation and helps you act.</T></p>
        </div>
        {error && <ErrorState message={error} />}

        <div className="card flex h-[60vh] flex-col p-4">
          <div className="flex-1 space-y-3 overflow-y-auto">
            {msgs.length === 0 && (
              <div className="grid h-full place-items-center text-center text-mute">
                <div><span className="icon-tile mx-auto h-12 w-12"><Icon name="chat" size={22} /></span>
                  <p className="mt-3"><T>Ask anything about your rights, deadlines or next steps.</T></p></div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'bg-teal text-white' : 'bg-slate-100 text-ink'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <div className="text-sm text-mute"><T>Thinking…</T></div>}
            <div ref={endRef} />
          </div>
          <div className="mt-3 flex gap-2">
            <input className="field flex-1" placeholder={tr('Type a message…')} value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
            <button onClick={send} disabled={loading} className="btn-primary"><T>Send</T></button>
          </div>
        </div>
      </div>

      <div className="space-y-5"><Memories /></div>
    </div>
  )
}
