import Icon from './Icon.jsx'

export function ErrorState({ message, onRetry }) {
  const offline = /offline|reach|network|failed to fetch/i.test(message || '')
  return (
    <div className="card border-l-2 border-l-rose-500 p-5">
      <div className="flex items-start gap-3">
        <Icon name="help" size={20} className="mt-0.5 shrink-0 text-rose-500" />
        <div className="flex-1">
          <p className="font-semibold" style={{ color: 'var(--navy)' }}>
            {offline ? 'Can’t reach the server' : 'Something went wrong'}
          </p>
          <p className="mt-1 text-sm text-mute">{message || 'Please try again.'}</p>
          {onRetry && <button onClick={onRetry} className="btn-ghost mt-3 px-3 py-1.5 text-xs">Try again</button>}
        </div>
      </div>
    </div>
  )
}

export function Spinner({ className = '' }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white ${className}`} />
}

export function Loading({ label = 'Loading…', rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      <p className="text-center text-sm text-mute">{label}</p>
    </div>
  )
}

export function EmptyState({ title, sub, action }) {
  return (
    <div className="card p-12 text-center">
      <p className="font-semibold" style={{ color: 'var(--navy)' }}>{title}</p>
      {sub && <p className="mt-1 text-sm text-mute">{sub}</p>}
      {action}
    </div>
  )
}
