import { useCallback, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, KomfConfigUpdateRequest } from '@/api/client'
import { useToast } from '@/components/Toast'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AutoSaveState {
  status: SaveStatus
  error: string | null
  retryLast: (() => void) | null
}

const SAVE_TIMEOUT_MS = 15_000

/**
 * Hook for auto-saving config changes with debounce + optimistic rollback.
 * - Toggle/select fields: immediate save (no debounce)
 * - Text fields: debounced save (configurable delay)
 * - Shows toast notifications on success/error
 * - Times out stuck saves after 15s with retry option
 */
export function useAutoSave(debounceMs = 600) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [state, setState] = useState<AutoSaveState>({ status: 'idle', error: null, retryLast: null })
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const lastPatchRef = useRef<KomfConfigUpdateRequest | null>(null)

  const clearTimeouts = useCallback(() => {
    clearTimeout(timerRef.current)
    clearTimeout(savedTimerRef.current)
    clearTimeout(timeoutRef.current)
  }, [])

  const mutation = useMutation({
    mutationFn: (patch: KomfConfigUpdateRequest) => api.updateConfig(patch),
    onSuccess: () => {
      clearTimeout(timeoutRef.current)
      queryClient.invalidateQueries({ queryKey: ['config'] })
      setState({ status: 'saved', error: null, retryLast: null })
      toast('Settings saved', 'success')
      clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setState({ status: 'idle', error: null, retryLast: null }), 2000)
    },
    onError: (err: unknown) => {
      clearTimeout(timeoutRef.current)
      queryClient.invalidateQueries({ queryKey: ['config'] })
      const msg = err instanceof Error ? err.message : String(err)
      setState({
        status: 'error',
        error: msg,
        retryLast: lastPatchRef.current ? () => mutation.mutate(lastPatchRef.current!) : null,
      })
      toast(`Save failed: ${msg}`, 'error')
    },
  })

  const save = useCallback(
    (patch: KomfConfigUpdateRequest, immediate = false) => {
      clearTimeouts()
      lastPatchRef.current = patch
      setState({ status: 'saving', error: null, retryLast: null })

      const doSave = () => {
        mutation.mutate(patch)
        // Timeout protection: if save takes too long, show warning
        timeoutRef.current = setTimeout(() => {
          setState({
            status: 'error',
            error: 'Save is taking too long — the server may be unresponsive.',
            retryLast: () => mutation.mutate(patch),
          })
          toast('Save timed out — try again or refresh the page', 'warning')
        }, SAVE_TIMEOUT_MS)
      }

      if (immediate) {
        doSave()
      } else {
        timerRef.current = setTimeout(doSave, debounceMs)
      }
    },
    [mutation, debounceMs, clearTimeouts, toast],
  )

  const dismissError = useCallback(() => {
    setState({ status: 'idle', error: null, retryLast: null })
  }, [])

  return { ...state, save, dismissError }
}
