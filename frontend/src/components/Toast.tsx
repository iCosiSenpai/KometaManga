import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = ++nextId
    setToasts((prev) => [...prev.slice(-2), { id, message, variant }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const ICON: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  error: <XCircle className="h-4 w-4 text-red-400" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  info: <Info className="h-4 w-4 text-sky-400" />,
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div
      className={clsx(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-slide-up',
        toast.variant === 'success' && 'border-emerald-800/40 bg-ink-900/95 text-emerald-300',
        toast.variant === 'error' && 'border-red-800/40 bg-ink-900/95 text-red-300',
        toast.variant === 'warning' && 'border-amber-800/40 bg-ink-900/95 text-amber-300',
        toast.variant === 'info' && 'border-sky-800/40 bg-ink-900/95 text-sky-300',
      )}
      role="alert"
    >
      <span className="mt-0.5 shrink-0">{ICON[toast.variant]}</span>
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 text-ink-500 hover:text-ink-300"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
