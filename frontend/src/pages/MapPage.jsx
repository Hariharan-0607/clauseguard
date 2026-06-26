import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { listReports } from '../api/client.js'
import { ErrorState } from '../components/States.jsx'
import T from '../components/T.jsx'
import { useUI } from '../ui.jsx'
import Icon from '../components/Icon.jsx'

const CAT = { landlord: 'home', employer: 'briefcase', platform: 'map' }

export default function MapPage() {
  const [reports, setReports] = useState(null)
  const [error, setError] = useState('')
  useUI().version
  const load = () => { setError(''); listReports().then(setReports).catch((e) => setError(e.message)) }
  useEffect(load, [])

  const rows = reports || []
  const pins = rows.filter((r) => r.lat && r.lon)

  return (
    <div className="container-app space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--navy)' }}><T>Repeat-offender map</T></h1>
        <p className="mt-1.5 text-mute">
          <T>Anonymous reports of landlords, employers and platforms flagged for unfair or illegal contracts. Powered by free OpenStreetMap.</T>
        </p>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="card overflow-hidden p-0">
        <MapContainer center={[20, 78]} zoom={3} scrollWheelZoom style={{ height: '52vh', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pins.map((r, i) => (
            <CircleMarker key={i} center={[r.lat, r.lon]} radius={8 + r.count * 2}
              pathOptions={{ color: '#E11D48', fillColor: '#E11D48', fillOpacity: 0.6 }}>
              <Popup>
                <strong>{r.counterparty}</strong><br />
                {r.count} report{r.count > 1 ? 's' : ''} · {r.city || r.jurisdiction}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div>
        <p className="label">Most reported</p>
        <div className="space-y-2">
          {reports && rows.length === 0 && <p className="text-mute">No reports yet.</p>}
          {!reports && <div className="skeleton h-20 rounded-2xl" />}
          {rows.map((r, i) => (
            <div key={i} className="card flex items-center justify-between p-3.5">
              <div className="flex items-center gap-3">
                <span className="icon-tile h-9 w-9"><Icon name={CAT[r.category] || 'flag'} size={16} /></span>
                <div>
                  <div className="font-semibold" style={{ color: 'var(--navy)' }}>{r.counterparty}</div>
                  <div className="text-xs text-mute">{r.city || r.jurisdiction} · {r.category}</div>
                </div>
              </div>
              <span className="chip" style={{ background: '#FEF2F2', color: '#E11D48' }}>{r.count} report{r.count > 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
