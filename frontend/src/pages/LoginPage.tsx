import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import { Button } from '@/components/Button'
import { KeyRound, Eye, EyeOff } from 'lucide-react'

interface LoginPageProps {
  onSuccess: () => void
}

const REMEMBER_KEY = 'kometa.login.remember'
const REMEMBER_USER_KEY = 'kometa.login.username'

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [username, setUsername] = useState(() => localStorage.getItem(REMEMBER_USER_KEY) ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(() => localStorage.getItem(REMEMBER_KEY) === '1')

  const loginMutation = useMutation({
    mutationFn: () => api.login({ username, password }),
    onSuccess: (data) => {
      if (data.authenticated) onSuccess()
    },
  })

  // Persist the "remember me" preference on successful login
  useEffect(() => {
    if (!loginMutation.data?.authenticated) return
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, '1')
      localStorage.setItem(REMEMBER_USER_KEY, username)
    } else {
      localStorage.removeItem(REMEMBER_KEY)
      localStorage.removeItem(REMEMBER_USER_KEY)
    }
  }, [loginMutation.data, remember, username])

  const canSubmit = username.trim() !== '' && password !== ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-accent-600/5 blur-3xl" />
        <div className="absolute -bottom-1/2 left-1/4 h-[600px] w-[600px] rounded-full bg-violet-600/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img
            src="/logo.png"
            alt="KometaManga"
            className="mx-auto mb-4 h-20 w-20 rounded-2xl shadow-lg shadow-accent-600/20"
          />
          <img
            src="/name.png"
            alt="KometaManga"
            className="mx-auto h-10 w-auto object-contain"
          />
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-ink-800/50 bg-ink-900/80 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600/10">
              <KeyRound className="h-5 w-5 text-accent-400" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink-100">Sign In</h2>
              <p className="text-xs text-ink-500">Enter your credentials to continue</p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (canSubmit) loginMutation.mutate()
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-300">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                autoFocus
                className="w-full rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-300">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 pr-12 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-300 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-ink-700 bg-ink-800 accent-accent-500"
              />
              Ricordami
            </label>

            {loginMutation.isError && (
              <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3">
                <p className="text-sm text-red-400">
                  {(loginMutation.error as Error).message || 'Invalid credentials'}
                </p>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit || loginMutation.isPending}
              loading={loginMutation.isPending}
              className="w-full"
            >
              {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
