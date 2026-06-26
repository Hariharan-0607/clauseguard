import { useEffect, useState } from 'react'
import { listOrgs } from '../api/client.js'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useUI } from '../ui.jsx'

export default function Directory() {
  const [country, setCountry] = useState('IN')
  const [orgs, setOrgs] = useState(null)
  const [error, setError] = useState('')
  useUI().version
  useEffect(() => { setOrgs(null); setError(''); listOrgs(country).then(setOrgs).catch((e) => setError(e.message)) }, [country])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Get real help</T></h1>
          <p className="text-mute"><T>Free legal aid and NGOs that can act on your case.</T></p>
        </div>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="field w-36">
          <option value="IN">India</option><option value="US-CA">California</option>
        </select>
      </div>

      {error && <ErrorState message={error} />}

      {!orgs
        ? <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
        : (
          <div className="grid gap-4 sm:grid-cols-2">
            {orgs.map((o, i) => (
              <div key={i} className="card animate-fade-up p-5" style={{ animationDelay: `${i * 50}ms` }}>
                <span className="chip" style={{ background: '#E6F7F5', color: 'var(--teal)' }}>{o.category}</span>
                <h3 className="mt-2.5 font-semibold" style={{ color: 'var(--navy)' }}>{o.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-mute">{o.help}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {o.url && <a href={o.url} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5 text-xs">Visit site</a>}
                  {o.phone && <a href={`tel:${o.phone}`} className="btn-ghost px-3 py-1.5 text-xs">{o.phone}</a>}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
