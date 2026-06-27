import { useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import { useT, useUI } from './ui.jsx'
import AiStatus from './components/AiStatus.jsx'
import AssistantWidget from './components/AssistantWidget.jsx'
import Icon from './components/Icon.jsx'

import Home from './pages/Home.jsx'
import Advisor from './pages/Advisor.jsx'
import Upload from './pages/Upload.jsx'
import Compare from './pages/Compare.jsx'
import Result from './pages/Result.jsx'
import Letter from './pages/Letter.jsx'
import History from './pages/History.jsx'
import SavedPlan from './pages/SavedPlan.jsx'
import Library from './pages/Library.jsx'
import Topic from './pages/Topic.jsx'
import Deadlines from './pages/Deadlines.jsx'
import Directory from './pages/Directory.jsx'
import Detection from './pages/Detection.jsx'
import Cases from './pages/Cases.jsx'
import Estimate from './pages/Estimate.jsx'
import Passport from './pages/Passport.jsx'
import Agent from './pages/Agent.jsx'
import Login from './pages/Login.jsx'

const UI_LANGS = [
  ['en', 'English'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['bn', 'বাংলা']
]

const NAV_ITEMS = (tr) => [
  ['/', 'home', tr('Home')],
  ['/advisor', 'chat', tr('Advisor')],
  ['/check', 'search', tr('Check')],
  ['/detection', 'shield', tr('Detection')],
  ['/cases', 'file', tr('Cases')],
  ['/estimate', 'briefcase', tr('Estimate')],
  ['/passport', 'shield', tr('Passport')],
  ['/agent', 'chat', tr('Agent')],
  ['/compare', 'compare', tr('Compare')],
  ['/library', 'book', tr('Rights')],
  ['/deadlines', 'clock', tr('Deadlines')],
  ['/help', 'help', tr('Help')],
  ['/history', 'file', tr('History')]
]

// Floating sidebar (desktop). Starts expanded with labels; the toggle collapses it
// to a slim icon rail with an animated width transition. Detached from the edge (floats).
function FloatingSidebar({ collapsed, onToggle, onSelect }) {
  const { user, signOut } = useAuth()
  const { lang, setLang, dark, setDark, version } = useUI()
  const tr = useT()
  void version
  const [menu, setMenu] = useState(null) // 'lang' | 'user' | null
  const items = NAV_ITEMS(tr)
  const currentLangName = (UI_LANGS.find(([c]) => c === lang) || ['', lang])[1]

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border shadow-lg"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      {/* logo + collapse toggle */}
      <div className="flex items-center gap-2.5 px-3 py-4">
        <Link to="/" title="ClauseGuard" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: 'var(--primary)', color: 'var(--text-inv)' }}>
          <Icon name="shield" size={19} />
        </Link>
        <span className="sb-label flex-1 truncate text-[17px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>ClauseGuard</span>
        <button onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}
          className="sb-toggle grid h-8 w-8 shrink-0 place-items-center rounded-lg transition hover:bg-[var(--highlight)]"
          style={{ color: 'var(--text-3)' }}>
          <Icon name="arrow" size={16} className={collapsed ? '' : 'rotate-180'} />
        </button>
      </div>

      {/* nav — scrollable so a long menu never pushes the footer controls off-screen */}
      <nav className="sb-scroll min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3">
        {items.map(([to, icon, label]) => (
          <SidebarLink key={to} to={to} icon={icon} label={label} collapsed={collapsed} onSelect={onSelect} />
        ))}
      </nav>

      {/* footer controls */}
      <div className="space-y-1 border-t px-3 py-3" style={{ borderColor: 'var(--border)' }}>
        <SidebarButton icon={dark ? 'sun' : 'moon'} label={`${dark ? 'Light' : 'Dark'} mode`} collapsed={collapsed} onClick={() => setDark(!dark)} />

        {/* language — globe icon + current language name; click to switch the whole UI */}
        <div className="relative">
          <SidebarButton icon="globe" label={currentLangName} collapsed={collapsed}
            active={menu === 'lang'} onClick={() => setMenu(menu === 'lang' ? null : 'lang')} />
          {menu === 'lang' && (
            <Popover onClose={() => setMenu(null)}>
              <p className="px-3 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{tr('Language')}</p>
              {UI_LANGS.map(([c, l]) => (
                <button key={c} onClick={() => { setLang(c); setMenu(null) }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm"
                  style={{ background: c === lang ? 'var(--highlight)' : 'transparent', color: 'var(--text)' }}>
                  <span>{l}</span>
                  {c === lang && <Icon name="check" size={14} />}
                </button>
              ))}
            </Popover>
          )}
        </div>

        {/* user — click to open the account menu (sign out) */}
        {user && (
          <div className="relative">
            <button onClick={() => setMenu(menu === 'user' ? null : 'user')} title={`${user.email} — ${tr('Sign out')}`}
              className="group relative flex w-full items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[var(--highlight)]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold"
                style={{ background: 'var(--highlight)', color: 'var(--text)' }}>
                {(user.name || user.email || '?').charAt(0).toUpperCase()}
              </span>
              <span className="sb-label min-w-0 flex-1 text-left">
                <span className="block truncate text-xs font-medium" style={{ color: 'var(--text)' }}>{user.name || 'Account'}</span>
                <span className="block truncate text-[11px]" style={{ color: 'var(--text-3)' }}>{user.email}</span>
              </span>
              <span className="sb-label inline-flex shrink-0" style={{ color: 'var(--text-3)' }} title={tr('Sign out')}>
                <Icon name="logout" size={16} />
              </span>
              {collapsed && <Tooltip label={tr('Sign out')} />}
            </button>
            {menu === 'user' && (
              <Popover onClose={() => setMenu(null)}>
                <p className="truncate px-3 py-1.5 text-xs" style={{ color: 'var(--text-3)' }}>{user.email}</p>
                <button onClick={() => { signOut(); setMenu(null) }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium" style={{ color: '#E11D48' }}>
                  <Icon name="logout" size={15} /> {tr('Sign out')}
                </button>
              </Popover>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SidebarLink({ to, icon, label, collapsed, onSelect }) {
  const [hovered, setHovered] = useState(false)
  return (
    <NavLink to={to} end={to === '/'} title={collapsed ? label : ''} onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all duration-150"
      style={({ isActive }) => ({
        background: isActive ? 'var(--highlight)' : hovered ? 'var(--highlight)' : 'transparent',
        color: isActive ? 'var(--text)' : hovered ? 'var(--text)' : 'var(--text-3)',
        transform: hovered && !isActive ? 'translateX(3px)' : 'none',
      })}>
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute -left-3 h-5 w-1 rounded-r-full" style={{ background: 'var(--primary)' }} />}
          <span className="grid h-6 w-6 shrink-0 place-items-center transition-transform duration-150"
            style={{ transform: hovered ? 'scale(1.15)' : 'scale(1)' }}>
            <Icon name={icon} size={20} />
          </span>
          <span className="sb-label truncate">{label}</span>
          {collapsed && <Tooltip label={label} />}
        </>
      )}
    </NavLink>
  )
}

function SidebarButton({ icon, glyph, label, collapsed, onClick, active }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button onClick={onClick} title={collapsed ? label : ''}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all duration-150"
      style={{
        background: active || hovered ? 'var(--highlight)' : 'transparent',
        color: active || hovered ? 'var(--text)' : 'var(--text-3)',
        transform: hovered && !active ? 'translateX(3px)' : 'none',
      }}>
      <span className="grid h-6 w-6 shrink-0 place-items-center text-xs font-bold transition-transform duration-150"
        style={{ transform: hovered ? 'scale(1.15)' : 'scale(1)' }}>
        {icon ? <Icon name={icon} size={19} /> : glyph}
      </span>
      <span className="sb-label truncate">{label}</span>
      {collapsed && <Tooltip label={label} />}
    </button>
  )
}

function Tooltip({ label }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium opacity-0 shadow-md transition group-hover:opacity-100"
      style={{ background: 'var(--text)', color: 'var(--text-inv)' }}>{label}</span>
  )
}

function Popover({ children, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Open upward, inside the sidebar, so the sidebar's overflow-hidden (needed for the
          collapse animation) doesn't clip it. */}
      <div className="absolute bottom-full left-0 right-0 z-50 mb-2 min-w-[160px] rounded-xl border p-1.5 shadow-lg"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        {children}
      </div>
    </>
  )
}

// Labeled sidebar — used inside the mobile drawer (touch-friendly).
function SidebarContent({ onNavigate }) {
  const { user, signOut } = useAuth()
  const { lang, setLang, dark, setDark, version } = useUI()
  const tr = useT()
  void version // re-render when translations arrive
  const items = NAV_ITEMS(tr)
  return (
    <div className="flex h-full flex-col">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: 'var(--primary)', color: 'var(--text-inv)' }}>
          <Icon name="shield" size={18} />
        </span>
        <span className="text-[17px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>ClauseGuard</span>
      </Link>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
        {items.map(([to, icon, label]) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition"
            style={({ isActive }) => isActive
              ? { background: 'var(--highlight)', color: 'var(--text)' }
              : { color: 'var(--text-3)' }}>
            <Icon name={icon} size={18} /> {label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t p-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{tr('Language')}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value)}
            className="rounded-md border px-2 py-1 text-xs"
            style={{ background: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
            {UI_LANGS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </div>
        <button onClick={() => setDark(!dark)}
          className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
          <span>{dark ? 'Dark' : 'Light'} mode</span>
          <span className="h-4 w-7 rounded-full p-0.5" style={{ background: dark ? 'var(--accent)' : 'var(--border)' }}>
            <span className="block h-3 w-3 rounded-full bg-white transition" style={{ transform: dark ? 'translateX(12px)' : 'none' }} />
          </span>
        </button>
        <div className="flex items-center justify-between">
          <AiStatus />
          {user && (
            <button onClick={() => { signOut(); onNavigate?.() }} className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>
              {tr('Sign out')}
            </button>
          )}
        </div>
        {user && <p className="truncate text-xs" style={{ color: 'var(--text-3)' }}>{user.email}</p>}
      </div>
    </div>
  )
}

function Protected({ children }) {
  const { user, ready } = useAuth()
  const { pathname } = useLocation()
  if (!ready) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <span className="h-7 w-7 animate-spin rounded-full border-2" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: pathname }} />
  return children
}

export default function App() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cg_sidebar_collapsed') === '1')
  const [hovering, setHovering] = useState(false)
  const setCollapsedPersist = (val) => {
    setCollapsed(val)
    localStorage.setItem('cg_sidebar_collapsed', val ? '1' : '0')
  }
  const toggleCollapsed = () => setCollapsedPersist(!collapsed)
  // Selecting a nav item auto-collapses the rail (it re-expands on hover).
  const collapseOnSelect = () => { if (!collapsed) setCollapsedPersist(true); setHovering(false) }

  // Visual width: collapsed intent, but a hover temporarily expands it (overlay).
  const showExpanded = !collapsed || hovering

  // Logged-out: full-width login, no sidebar.
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Gate />} />
      </Routes>
    )
  }

  return (
    <div className={`flex min-h-full ${collapsed ? 'sb-collapsed' : ''} ${showExpanded ? '' : 'sb-rail'}`} style={{ background: 'var(--bg)' }}>
      {/* Desktop floating sidebar — collapses on select, expands on hover */}
      <aside className="sb-aside fixed inset-y-0 left-0 z-30 hidden p-3 lg:block"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}>
        <FloatingSidebar collapsed={!showExpanded} onToggle={toggleCollapsed} onSelect={collapseOnSelect} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="sb-main flex min-h-full flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 lg:hidden"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <button onClick={() => setOpen(true)} className="rounded-md border p-2" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <Icon name="menu" size={18} />
          </button>
          <span className="font-bold" style={{ color: 'var(--text)' }}>ClauseGuard</span>
        </div>

        <main className="flex-1 px-5 py-8 sm:px-8">
          <div className="mx-auto max-w-4xl">
            <Routes>
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/" element={<Protected><Home /></Protected>} />
              <Route path="/advisor" element={<Protected><Advisor /></Protected>} />
              <Route path="/check" element={<Protected><Upload /></Protected>} />
              <Route path="/detection" element={<Protected><Detection /></Protected>} />
              <Route path="/cases" element={<Protected><Cases /></Protected>} />
              <Route path="/estimate" element={<Protected><Estimate /></Protected>} />
              <Route path="/passport" element={<Protected><Passport /></Protected>} />
              <Route path="/agent" element={<Protected><Agent /></Protected>} />
              <Route path="/compare" element={<Protected><Compare /></Protected>} />
              <Route path="/result/:id" element={<Protected><Result /></Protected>} />
              <Route path="/letter/:id" element={<Protected><Letter /></Protected>} />
              <Route path="/history" element={<Protected><History /></Protected>} />
              <Route path="/plan/:id" element={<Protected><SavedPlan /></Protected>} />
              <Route path="/library" element={<Protected><Library /></Protected>} />
              <Route path="/library/:id" element={<Protected><Topic /></Protected>} />
              <Route path="/deadlines" element={<Protected><Deadlines /></Protected>} />
              <Route path="/help" element={<Protected><Directory /></Protected>} />
            </Routes>
          </div>
        </main>
      </div>

      <AssistantWidget />
    </div>
  )
}

function Gate() {
  const { pathname } = useLocation()
  return <Navigate to="/login" replace state={{ from: pathname }} />
}
