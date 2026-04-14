import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type AppLogEntry } from '@/api/client'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { PageSpinner } from '@/components/Spinner'
import { ErrorState } from '@/components/ErrorState'
import {
  ArrowDown,
  Copy,
  Download,
  Filter,
  RefreshCw,
} from 'lucide-react'
import { clsx } from 'clsx'

type LogLevel = 'ALL' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const LEVEL_COLORS: Record<string, string> = {
  ERROR: 'text-red-400',
  WARN: 'text-amber-400',
  INFO: 'text-emerald-400',
  DEBUG: 'text-ink-500',
  TRACE: 'text-ink-600',
}

const FILTER_OPTIONS: { value: LogLevel; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DEBUG', label: 'Debug' },
  { value: 'INFO', label: 'Info' },
  { value: 'WARN', label: 'Warn' },
  { value: 'ERROR', label: 'Error' },
]

const LEVEL_PRIORITY: Record<string, number> = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
}

function formatLogLine(entry: AppLogEntry): string {
  const d = new Date(entry.timestamp)
  const ts = d.toISOString()
  return `${ts} [${entry.level.padEnd(5)}] ${entry.logger} - ${entry.message}`
}

export function LogsPage() {
  const [filter, setFilter] = useState<LogLevel>('ALL')
  const [autoScroll, setAutoScroll] = useState(true)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  const logsQuery = useQuery({
    queryKey: ['app-logs'],
    queryFn: () => api.getLogs(500),
    refetchInterval: 3_000,
  })

  const logs: AppLogEntry[] = logsQuery.data ?? []

  const filtered = logs.filter((entry) => {
    if (filter !== 'ALL' && (LEVEL_PRIORITY[entry.level] ?? 0) < (LEVEL_PRIORITY[filter] ?? 0)) {
      return false
    }
    if (search) {
      const q = search.toLowerCase()
      return (
        entry.message.toLowerCase().includes(q) ||
        entry.logger.toLowerCase().includes(q) ||
        entry.thread.toLowerCase().includes(q)
      )
    }
    return true
  })

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filtered, autoScroll])

  if (logsQuery.isLoading) return <PageSpinner />
  if (logsQuery.isError)
    return <ErrorState message="Cannot load application logs" onRetry={() => logsQuery.refetch()} />

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Application Logs"
        description="Live application log output from the KometaManga backend."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const text = filtered.map(formatLogLine).join('\n')
                navigator.clipboard.writeText(text).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                })
              }}
              disabled={filtered.length === 0}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied!' : 'Copy All'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const text = filtered.map(formatLogLine).join('\n')
                const blob = new Blob([text], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `kometamanga-logs-${new Date().toISOString().slice(0, 10)}.log`
                a.click()
                URL.revokeObjectURL(url)
              }}
              disabled={filtered.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logsQuery.refetch()}
              loading={logsQuery.isFetching}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button
              variant={autoScroll ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setAutoScroll((a) => !a)}
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Auto-scroll
            </Button>
          </div>
        }
      />

      {/* Filter & search bar */}
      <div className="mb-4 flex items-center gap-3">
        <Filter className="h-4 w-4 text-ink-500" />
        <div className="flex items-center gap-1 rounded-xl border border-ink-800/50 bg-ink-900/30 p-1">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                filter === value
                  ? 'bg-ink-800 text-ink-100'
                  : 'text-ink-400 hover:bg-ink-800/50 hover:text-ink-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search logs..."
          className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-sm text-ink-100 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
        />
        <span className="shrink-0 text-xs text-ink-500">
          {filtered.length} / {logs.length}
        </span>
      </div>

      {/* Log output */}
      <Card className="!p-0 max-h-[calc(100vh-16rem)] overflow-y-auto font-mono text-xs">
        {filtered.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-ink-500">
            No log entries found.
          </div>
        ) : (
          <div className="divide-y divide-ink-800/20">
            {filtered.map((entry, i) => (
              <div
                key={`${entry.timestamp}-${i}`}
                className="flex gap-3 px-4 py-1.5 hover:bg-ink-800/20 transition-colors leading-relaxed"
              >
                <span className="shrink-0 text-ink-600 tabular-nums">
                  {formatTimestamp(entry.timestamp)}
                </span>
                <span
                  className={clsx(
                    'shrink-0 w-12 text-right font-semibold',
                    LEVEL_COLORS[entry.level] ?? 'text-ink-400',
                  )}
                >
                  {entry.level}
                </span>
                <span className="shrink-0 max-w-[180px] truncate text-ink-500" title={entry.logger}>
                  {shortLogger(entry.logger)}
                </span>
                <span className="min-w-0 flex-1 text-ink-200 break-all whitespace-pre-wrap">
                  {entry.message}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </Card>
    </div>
  )
}

function formatTimestamp(epochMs: number): string {
  const d = new Date(epochMs)
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function shortLogger(name: string): string {
  const parts = name.split('.')
  if (parts.length <= 2) return name
  return parts.slice(-2).join('.')
}
