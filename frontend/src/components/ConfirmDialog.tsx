import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/Button'

interface ConfirmDialogProps {
  open: boolean
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 px-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-ink-200">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook for managing confirm dialog state.
 * Usage:
 *   const { confirm, dialogProps } = useConfirm()
 *   confirm('Are you sure?', () => doSomething())
 *   <ConfirmDialog {...dialogProps} />
 */
export function useConfirm() {
  const [state, setState] = useState<{ message: string; action: () => void } | null>(null)

  const confirm = useCallback((message: string, action: () => void) => {
    setState({ message, action })
  }, [])

  const dialogProps: ConfirmDialogProps = {
    open: state !== null,
    message: state?.message ?? '',
    onConfirm: () => {
      state?.action()
      setState(null)
    },
    onCancel: () => setState(null),
  }

  return { confirm, dialogProps }
}
