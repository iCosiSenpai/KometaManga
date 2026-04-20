import { useState, useEffect, useCallback } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useIsFetching, useIsMutating, useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import {
  LayoutDashboard,
  Library,
  Activity,
  Tv2,
  ScrollText,
  ExternalLink,
  Menu,
  X,
  Sun,
  Moon,
  Settings,
  ArrowUpCircle,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Download,
  LogOut,
  Info,
} from 'lucide-react'
import { clsx } from 'clsx'

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/libraries', icon: Library, label: 'Libraries' },
    ],
  },
  {
    label: 'Manga',
    items: [
      { to: '/sources', icon: BookOpen, label: 'Browse Sources' },
      { to: '/downloads', icon: Download, label: 'Downloads' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
      { to: '/jobs', icon: Activity, label: 'Jobs' },
      { to: '/logs', icon: ScrollText, label: 'Logs' },
    ],
  },
  {
    label: 'Integration',
    items: [
      { to: '/komga', icon: Tv2, label: 'Komga' },
      { to: '/about', icon: Info, label: 'About' },
    ],
  },
] as const

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: useCallback(() => setDark((d) => !d), []) }
}

export function Layout() {
  const isFetching = useIsFetching()
  const isMutating = useIsMutating()
  const isLoading = isFetching > 0 || isMutating > 0
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })
  const { dark, toggle: toggleTheme } = useTheme()

  // Effective collapsed state: never collapsed when mobile sidebar is open
  const effectiveCollapsed = collapsed && !sidebarOpen

  // Auth status for showing logout button
  const authQuery = useQuery({
    queryKey: ['auth-status'],
    queryFn: api.getAuthStatus,
    staleTime: 60_000 * 5,
    retry: false,
  })
  const showLogout = authQuery.data?.authConfigured && authQuery.data?.authenticated

  const handleLogout = useCallback(async () => {
    try { await api.logout() } catch (_) { /* ignore */ }
    window.location.reload()
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }, [])

  // Close sidebar on route change (mobile)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="flex min-h-screen bg-ink-950 dark:bg-ink-950 light:bg-ink-50">
      {/* Global loading bar */}
      {isLoading && (
        <div className="fixed left-0 right-0 top-0 z-50 h-0.5">
          <div className="h-full animate-loading-bar bg-accent-500" />
        </div>
      )}

      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-xl border border-ink-800/40 bg-ink-900/95 p-2.5 text-ink-300 shadow-lg backdrop-blur-md active:scale-95 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-ink-800/40 bg-ink-950/98 backdrop-blur-md transition-all duration-300 ease-out',
          'md:translate-x-0 md:z-30',
          collapsed ? 'md:w-[80px]' : 'md:w-72',
          'w-72',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Mobile decorative background (blurred, behind menu items) */}
        <img
          src="/vertical1.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-contain object-bottom opacity-20 blur-md md:hidden"
        />

        {/* Logo + mobile close */}
        <div className="relative z-10 flex h-24 items-center justify-between border-b border-ink-800/30 px-4">
          <NavLink to="/" className="flex items-center gap-3 overflow-hidden" onClick={closeSidebar}>
            <img
              src="/logo.png"
              alt="KometaManga"
              className="h-14 w-14 shrink-0 rounded-xl shadow-lg shadow-accent-600/10"
            />
            {!effectiveCollapsed && (
              <>
                <img
                  src="/name.png"
                  alt="KometaManga"
                  className="hidden h-14 w-auto max-w-[200px] object-contain md:block"
                />
                <img
                  src="/nameshort.png"
                  alt="KometaManga"
                  className="h-14 w-auto max-w-[140px] object-contain md:hidden"
                />
              </>
            )}
          </NavLink>
          <button
            onClick={closeSidebar}
            className="rounded-xl p-2 text-ink-500 hover:text-ink-300 active:scale-95 md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="relative z-10 flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {si > 0 && <div className="my-3 mx-2 h-px bg-ink-800/30" />}
              {!effectiveCollapsed && section.label && (
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-600">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ to, icon: Icon, label, ...rest }) => (
                  <NavItem
                    key={to}
                    to={to}
                    icon={Icon}
                    label={label}
                    end={'end' in rest && (rest as { end?: boolean }).end}
                    onClick={closeSidebar}
                    collapsed={effectiveCollapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="relative z-10 shrink-0 border-t border-ink-800/30 px-3 py-2 md:px-4 md:py-3 space-y-1.5 md:space-y-2">
          {/* Collapse toggle (desktop only) */}
          <button
            onClick={toggleCollapsed}
            className="hidden md:flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-ink-400 hover:bg-ink-800/50 hover:text-ink-200 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            {!collapsed && 'Collapse'}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-ink-400 hover:bg-ink-800/50 hover:text-ink-200 transition-colors"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {!effectiveCollapsed && (dark ? 'Light Mode' : 'Dark Mode')}
          </button>

          {/* Logout button (only when auth is configured) */}
          {showLogout && (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              aria-label="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
              {!effectiveCollapsed && 'Logout'}
            </button>
          )}

          {/* ── Mobile-only: compact version ── */}
          {!effectiveCollapsed && (
            <div className="flex items-center gap-2.5 md:hidden">
              <span className="font-mono text-[10px] text-ink-600">
                <VersionBadgeInline />
              </span>
            </div>
          )}

          {/* ── Desktop-only: version + credits ── */}
          {!effectiveCollapsed && (
            <div className="hidden md:block space-y-2.5">
              <VersionBadge />
              <div className="space-y-0.5 px-1">
                <p className="text-[10px] text-ink-600">
                  Based on{' '}
                  <a href="https://github.com/Snd-R/Komf" target="_blank" rel="noopener noreferrer" className="text-ink-500 hover:text-accent-400 transition-colors">
                    Komf by Snd-R
                  </a>
                  {' · '}
                  <a href="https://github.com/iCosiSenpai" target="_blank" rel="noopener noreferrer" className="text-ink-500 hover:text-accent-400 transition-colors">
                    iCosiSenpai
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className={clsx('relative z-10 flex-1 transition-all duration-300 ease-out', collapsed ? 'md:ml-[80px]' : 'md:ml-72')} role="main">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-14 md:px-10 md:py-8">
          <Breadcrumb />
          <Outlet />
        </div>
      </main>

      {/* Desktop decorative verticals — fixed to viewport edges, behind content.
          On lg: ambient blur at low opacity so text stays readable.
          On xl+: crisp full-opacity imagery. */}
      <img
        src="/vertical1.png"
        alt=""
        aria-hidden
        className="pointer-events-none fixed bottom-0 z-[1] hidden h-[60vh] max-h-[700px] w-auto select-none object-contain opacity-30 blur-2xl motion-safe:transition-[opacity,filter] motion-safe:duration-500 lg:block xl:h-[70vh] xl:max-h-[850px] xl:opacity-80 xl:blur-0"
        style={{ left: collapsed ? 96 : 304 }}
      />
      <img
        src="/vertical3.png"
        alt=""
        aria-hidden
        className="pointer-events-none fixed bottom-0 right-4 z-[1] hidden h-[60vh] max-h-[700px] w-auto select-none object-contain opacity-30 blur-2xl motion-safe:transition-[opacity,filter] motion-safe:duration-500 lg:block xl:h-[70vh] xl:max-h-[850px] xl:opacity-80 xl:blur-0"
      />
    </div>
  )
}

function NavItem({
  to,
  icon: Icon,
  label,
  end,
  onClick,
  collapsed,
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  end?: boolean
  onClick?: () => void
  collapsed?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        clsx(
          'group relative flex items-center rounded-xl text-sm font-medium transition-all duration-150 active:scale-[0.97]',
          collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-3 md:py-2.5',
          isActive
            ? 'bg-accent-600/10 text-accent-400'
            : 'text-ink-400 hover:bg-ink-800/50 hover:text-ink-200',
        )
      }
    >
      {({ isActive }: { isActive: boolean }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent-500 transition-all" />
          )}
          <Icon className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>{label}</span>}
        </>
      )}
    </NavLink>
  )
}

function VersionBadge() {
  const [showDocker, setShowDocker] = useState(false)
  const [copied, setCopied] = useState(false)

  const versionQuery = useQuery({
    queryKey: ['version'],
    queryFn: api.getVersion,
    staleTime: 60_000 * 30, // consider fresh for 30 min
    refetchInterval: 60_000 * 60, // re-check every hour
    retry: false,
  })

  const v = versionQuery.data
  if (!v) return null

  const dockerCmd = 'docker compose pull && docker compose up -d'

  function copyCommand() {
    navigator.clipboard.writeText(dockerCmd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-lg bg-ink-900/60 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-ink-500">v{v.current}</span>
        <button
          onClick={() => versionQuery.refetch()}
          disabled={versionQuery.isFetching}
          className="rounded p-0.5 text-ink-500 transition-colors hover:text-ink-300 disabled:opacity-40"
          aria-label="Check for updates"
        >
          <RefreshCw className={clsx('h-3 w-3', versionQuery.isFetching && 'animate-spin')} />
        </button>
      </div>
      {v.updateAvailable && v.latest && (
        <div className="mt-1.5 space-y-1.5">
          <a
            href={v.releaseUrl ?? 'https://github.com/iCosiSenpai/KometaManga/releases'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
          >
            <ArrowUpCircle className="h-3 w-3" />
            {v.latest} available
            <ExternalLink className="ml-auto h-2.5 w-2.5" />
          </a>
          <button
            onClick={() => setShowDocker(!showDocker)}
            className="w-full text-left text-[10px] text-ink-500 hover:text-ink-300"
          >
            {showDocker ? '▾ Hide' : '▸ How to update (Docker)'}
          </button>
          {showDocker && (
            <div className="space-y-2 rounded-md border border-ink-800/50 bg-ink-950/80 p-2">
              <p className="text-[10px] leading-relaxed text-ink-400">
                <span className="font-medium text-ink-300">1.</span> Open a terminal in your KometaManga folder
                <br />
                <span className="font-medium text-ink-300">2.</span> Run:
              </p>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 break-all rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-ink-300">
                  {dockerCmd}
                </code>
                <button
                  onClick={copyCommand}
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-accent-400 hover:bg-ink-800"
                >
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-ink-500">
                On a NAS, SSH into the host first, then <code className="text-ink-400">cd</code> to the compose directory.
              </p>
            </div>
          )}
        </div>
      )}
      {!v.updateAvailable && (
        <p className="mt-1 text-[10px] text-ink-600">Up to date</p>
      )}
    </div>
  )
}

function VersionBadgeInline() {
  const versionQuery = useQuery({
    queryKey: ['version'],
    queryFn: api.getVersion,
    staleTime: 60_000 * 30,
    retry: false,
  })
  const v = versionQuery.data
  if (!v) return null
  return <>v{v.current}</>
}

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/libraries': 'Libraries',
  '/sources': 'Browse Sources',
  '/downloads': 'Downloads',
  '/jobs': 'Jobs',
  '/komga': 'Komga',
  '/logs': 'Logs',
  '/settings': 'Settings',
  '/settings/event-listener': 'Event Listener',
  '/settings/processing': 'Processing',
  '/settings/providers': 'Providers',
  '/settings/notifications': 'Notifications',
  '/settings/scheduler': 'Scheduler',
  '/settings/download': 'Download Config',
  '/settings/sources': 'Sources Health',
  '/settings/security': 'Security',
}

function Breadcrumb() {
  const { pathname } = useLocation()
  if (pathname === '/') return null

  const segments = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = []

  let accumulated = ''
  for (const seg of segments) {
    accumulated += `/${seg}`
    const label = ROUTE_LABELS[accumulated]
    if (label) crumbs.push({ label, path: accumulated })
  }

  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-ink-500">
      <NavLink to="/" className="hover:text-ink-300 transition-colors">Dashboard</NavLink>
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1.5">
          <span className="text-ink-700">/</span>
          {i === crumbs.length - 1 ? (
            <span className="text-ink-300">{crumb.label}</span>
          ) : (
            <NavLink to={crumb.path} className="hover:text-ink-300 transition-colors">
              {crumb.label}
            </NavLink>
          )}
        </span>
      ))}
    </nav>
  )
}
