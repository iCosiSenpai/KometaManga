import { clsx } from 'clsx'
import { Check, AlertCircle, Loader2 } from 'lucide-react'
import { useId, useState, useEffect, type ReactNode } from 'react'

// --- Save status indicator ---

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function SaveIndicator({
  status,
  error,
  onDismiss,
}: {
  status: SaveStatus
  error: string | null
  onDismiss?: () => void
}) {
  if (status === 'idle') return null
  return (
    <div
      className={clsx(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all',
        status === 'saving' && 'text-ink-400',
        status === 'saved' && 'text-emerald-400',
        status === 'error' && 'cursor-pointer bg-red-500/10 text-red-400',
      )}
      onClick={status === 'error' ? onDismiss : undefined}
      title={error ?? undefined}
    >
      {status === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {status === 'saved' && <Check className="h-3.5 w-3.5" />}
      {status === 'error' && <AlertCircle className="h-3.5 w-3.5" />}
      {status === 'saving' && 'Saving…'}
      {status === 'saved' && 'Saved'}
      {status === 'error' && (error ? `Error: ${error}` : 'Save failed')}
    </div>
  )
}

// --- Section container ---

export function SettingsSection({
  title,
  description,
  children,
  action,
  icon,
}: {
  title: string
  description?: string
  children: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-ink-800/50 bg-ink-900/50 p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-800/60">
              {icon}
            </div>
          )}
          <div>
            <h3 className="font-display text-lg font-semibold text-ink-100">{title}</h3>
            {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

// --- Text input field ---

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  description,
  error,
  required,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'password' | 'url'
  placeholder?: string
  description?: string
  error?: string
  required?: boolean
  disabled?: boolean
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink-300">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={local}
        disabled={disabled}
        onChange={(e) => {
          if (disabled) return
          setLocal(e.target.value)
          onChange(e.target.value)
        }}
        placeholder={placeholder}
        className={clsx(
          'w-full rounded-lg border bg-ink-950/50 px-3 py-2 text-sm text-ink-100 placeholder-ink-600 transition-colors focus:outline-none focus:ring-1',
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
            : 'border-ink-700 focus:border-accent-500 focus:ring-accent-500/30',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!error && description && <p className="text-xs text-ink-500">{description}</p>}
    </div>
  )
}

// --- Number input field ---

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  description,
  error,
  disabled,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  placeholder?: string
  description?: string
  error?: string
  disabled?: boolean
}) {
  const [local, setLocal] = useState(value != null ? String(value) : '')
  useEffect(() => { setLocal(value != null ? String(value) : '') }, [value])

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-ink-300">{label}</label>
      <input
        type="number"
        value={local}
        disabled={disabled}
        onChange={(e) => {
          if (disabled) return
          setLocal(e.target.value)
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        className={clsx(
          'w-full rounded-lg border bg-ink-950/50 px-3 py-2 text-sm text-ink-100 placeholder-ink-600 transition-colors focus:outline-none focus:ring-1',
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
            : 'border-ink-700 focus:border-accent-500 focus:ring-accent-500/30',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!error && description && <p className="text-xs text-ink-500">{description}</p>}
    </div>
  )
}

// --- Toggle switch ---

export function ToggleField({
  label,
  checked,
  onChange,
  description,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  description?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-ink-950/30 px-4 py-3">
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-ink-200">{label}</span>
        {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
      </div>
      <label className={clsx('relative inline-flex h-6 w-11 shrink-0', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={() => onChange(!checked)}
          className="peer sr-only"
          aria-label={label}
        />
        <span
          className={clsx(
            'absolute inset-0 rounded-full transition-colors duration-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-500/30 peer-focus:ring-offset-2 peer-focus:ring-offset-ink-900',
            checked ? 'bg-accent-600' : 'bg-ink-700',
          )}
        />
        <span
          className={clsx(
            'pointer-events-none absolute top-0.5 inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </label>
    </div>
  )
}

// --- Select / dropdown ---

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  description,
  disabled,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  description?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-300">{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className={clsx(
          'w-full rounded-lg border border-ink-700 bg-ink-950/50 px-3 py-2 text-sm text-ink-100 transition-colors focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {description && <p className="text-xs text-ink-500">{description}</p>}
    </div>
  )
}

// --- Multi-select checkboxes ---

export function MultiSelectField<T extends string>({
  label,
  values,
  onChange,
  options,
  description,
  disabled,
}: {
  label: string
  values: T[]
  onChange: (values: T[]) => void
  options: { value: T; label: string }[]
  description?: string
  disabled?: boolean
}) {
  const toggle = (v: T) => {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-ink-300">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = values.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => toggle(opt.value)}
              className={clsx(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                selected
                  ? 'border-accent-500/50 bg-accent-600/10 text-accent-400'
                  : 'border-ink-700 bg-ink-950/30 text-ink-400 hover:bg-ink-800/50',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      {description && <p className="text-xs text-ink-500">{description}</p>}
    </div>
  )
}

// --- Tag list editor (for library filters etc.) ---

export function TagListField({
  label,
  values,
  onChange,
  placeholder,
  description,
  suggestions,
  disabled,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  description?: string
  suggestions?: { value: string; label: string }[]
  disabled?: boolean
}) {
  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
  }

  const removeTag = (tag: string) => {
    onChange(values.filter((v) => v !== tag))
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-ink-300">{label}</label>

      {/* Current tags */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-ink-800 px-2 py-1 text-xs text-ink-200"
            >
              {suggestions?.find((s) => s.value === tag)?.label ?? tag}
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeTag(tag)}
                className={clsx('ml-0.5 text-ink-500 hover:text-ink-200', disabled && 'cursor-not-allowed opacity-60')}
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Suggestions or input */}
      {suggestions ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions
            .filter((s) => !values.includes(s.value))
            .map((s) => (
              <button
                key={s.value}
                type="button"
                disabled={disabled}
                onClick={() => addTag(s.value)}
                className={clsx(
                  'rounded-md border border-dashed border-ink-700 px-2 py-1 text-xs text-ink-500 transition-colors hover:border-ink-500 hover:text-ink-300',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                + {s.label}
              </button>
            ))}
        </div>
      ) : (
        <input
          type="text"
          disabled={disabled}
          placeholder={placeholder ?? 'Type and press Enter to add'}
          onKeyDown={(e) => {
            if (disabled) return
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag(e.currentTarget.value)
              e.currentTarget.value = ''
            }
          }}
          className={clsx(
            'w-full rounded-lg border border-ink-700 bg-ink-950/50 px-3 py-2 text-sm text-ink-100 placeholder-ink-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        />
      )}

      {description && <p className="text-xs text-ink-500">{description}</p>}
    </div>
  )
}
