import { useEffect, useState } from 'react'
import { aiHealth } from '../api/client.js'

const LABELS = { groq: 'Groq', ollama: 'Ollama', mock: 'Demo' }

export default function AiStatus({ compact = false, compactDot = false }) {
  const [s, setS] = useState({ state: 'checking' })
  useEffect(() => {
    let on = true
    aiHealth()
      .then((d) => on && setS({ state: d.ok ? 'ok' : 'down', provider: d.provider }))
      .catch(() => on && setS({ state: 'offline' }))
    return () => { on = false }
  }, [])

  const map = {
    checking: ['text-slate-400', 'bg-slate-300', 'Connecting'],
    ok: ['text-emerald-600', 'bg-emerald-500', `AI · ${LABELS[s.provider] || s.provider}`],
    down: ['text-amber-600', 'bg-amber-500', 'AI key issue'],
    offline: ['text-rose-500', 'bg-rose-500', 'API offline']
  }
  const [cls, dot, text] = map[s.state] || map.checking

  if (compactDot) {
    return <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} title={text} />
  }
  if (compact) {
    return (
      <span className="group relative grid h-11 w-11 place-items-center" title={text}>
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium opacity-0 shadow-md transition group-hover:opacity-100"
          style={{ background: 'var(--text)', color: 'var(--text-inv)' }}>{text}</span>
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{text}
    </span>
  )
}
