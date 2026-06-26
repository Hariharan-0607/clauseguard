import { Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { useUI } from '../ui.jsx'
import T from '../components/T.jsx'
import Icon from '../components/Icon.jsx'

const FEATURES = [
  { to: '/advisor', icon: 'chat', title: 'Get legal advice', desc: 'Describe your problem in plain words; get your rights and a step-by-step plan.' },
  { to: '/check', icon: 'search', title: 'Check a contract', desc: 'AI explains every clause and flags unfair or illegal terms.' },
  { to: '/compare', icon: 'compare', title: 'Compare two contracts', desc: 'Put two offers side by side and see which one is safer.' },
  { to: '/library', icon: 'book', title: 'Know your rights', desc: 'Plain-language guides on deposits, eviction, wages and more.' },
  { to: '/map', icon: 'map', title: 'Offender map', desc: 'See landlords and employers reported by other people.' },
  { to: '/deadlines', icon: 'clock', title: 'Deadline tracker', desc: 'Never miss a notice period, rent date or renewal again.' },
  { to: '/help', icon: 'help', title: 'Get real help', desc: 'Find free legal aid and NGOs that can act on your case.' }
]

export default function Home() {
  const { user } = useAuth()
  useUI().version // re-render when translations arrive
  return (
    <div className="space-y-14">
      <section className="animate-fade-up">
        <span className="chip border" style={{ borderColor: 'var(--line)', color: 'var(--mute)' }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--teal)' }} />
          <T>Free AI legal-rights platform</T>
        </span>
        <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl" style={{ color: 'var(--navy)' }}>
          {user ? <><T>Welcome back</T>, {user.name || 'friend'}.</> : <T>Understand the contract before you sign it.</T>}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-mute">
          <T>ClauseGuard helps gig workers, tenants and migrants understand contracts, know their rights, and challenge unfair or illegal terms — for free, in their own language.</T>
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/advisor" className="btn-primary px-5 py-3 text-base">
            <Icon name="chat" size={18} /> <T>Get legal advice</T>
          </Link>
          <Link to="/check" className="btn-ghost px-5 py-3 text-base"><T>Check a contract</T></Link>
        </div>
      </section>

      <section>
        <p className="label"><T>Everything in one place</T></p>
        <div className="grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-3" style={{ borderColor: 'var(--line)', background: 'var(--line)' }}>
          {FEATURES.map((f, i) => (
            <Link key={f.to} to={f.to}
              className="group flex flex-col p-6 transition animate-fade-up"
              style={{ background: 'var(--card)', animationDelay: `${i * 50}ms` }}>
              <span className="icon-tile h-10 w-10"><Icon name={f.icon} size={18} /></span>
              <h3 className="mt-4 font-semibold" style={{ color: 'var(--text)' }}><T>{f.title}</T></h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-3)' }}><T>{f.desc}</T></p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium opacity-0 transition group-hover:opacity-100" style={{ color: 'var(--accent)' }}>
                <T>Open</T> <Icon name="arrow" size={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-8 border-t pt-10 sm:grid-cols-3" style={{ borderColor: 'var(--line)' }}>
        <Stat n="3" label="SDGs advanced" sub="Justice · Work · Equality" />
        <Stat n="2" label="Jurisdictions" sub="India · California" />
        <Stat n="100%" label="Free & open-source" sub="No paywall, ever" />
      </section>
    </div>
  )
}

function Stat({ n, label, sub }) {
  return (
    <div>
      <div className="text-3xl font-extrabold" style={{ color: 'var(--brand)' }}>{n}</div>
      <div className="mt-1 font-semibold" style={{ color: 'var(--navy)' }}><T>{label}</T></div>
      <div className="text-sm text-mute"><T>{sub}</T></div>
    </div>
  )
}
