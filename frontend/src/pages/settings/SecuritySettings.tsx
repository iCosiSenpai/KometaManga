import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { PageSpinner } from '@/components/Spinner'
import { ErrorState } from '@/components/ErrorState'
import { useToast } from '@/components/Toast'
import { Shield, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react'

export function SecuritySettings() {
  const queryClient = useQueryClient()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const { toast } = useToast()

  // For initial setup (no auth configured)
  const [setupUsername, setSetupUsername] = useState('')
  const [setupPassword, setSetupPassword] = useState('')
  const [showSetupPassword, setShowSetupPassword] = useState(false)

  const authQuery = useQuery({
    queryKey: ['auth-status'],
    queryFn: api.getAuthStatus,
  })

  const setupMutation = useMutation({
    mutationFn: () =>
      api.setupAuth({ username: setupUsername, password: setupPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-status'] })
      setSetupUsername('')
      setSetupPassword('')
      toast('Account created successfully', 'success')
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateAuth({
        currentPassword: currentPassword || undefined,
        newUsername: newUsername || undefined,
        newPassword: newPassword || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-status'] })
      setCurrentPassword('')
      setNewUsername('')
      setNewPassword('')
      setConfirmPassword('')
      toast('Credentials updated successfully', 'success')
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  if (authQuery.isLoading) return <PageSpinner />
  if (authQuery.isError)
    return <ErrorState message="Cannot check auth status" onRetry={() => authQuery.refetch()} />

  const authConfigured = authQuery.data?.authConfigured ?? false
  const passwordMismatch = confirmPassword !== '' && newPassword !== confirmPassword
  const canUpdate =
    currentPassword !== '' &&
    (newUsername !== '' || (newPassword.length >= 4 && !passwordMismatch))

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Security"
        description="Manage login credentials for your KometaManga instance."
      />

      {!authConfigured ? (
        // No auth configured — show setup
        <Card>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/10">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink-100">No Login Configured</h3>
              <p className="text-xs text-ink-500">
                Your instance is currently accessible without authentication.
                Create an account to protect it.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-300">Username</label>
              <input
                type="text"
                value={setupUsername}
                onChange={(e) => setSetupUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                className="w-full rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-300">Password</label>
              <div className="relative">
                <input
                  type={showSetupPassword ? 'text' : 'password'}
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  placeholder="Min. 4 characters"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 pr-12 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowSetupPassword(!showSetupPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300"
                >
                  {showSetupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={() => setupMutation.mutate()}
              disabled={!setupUsername.trim() || setupPassword.length < 4 || setupMutation.isPending}
              loading={setupMutation.isPending}
            >
              <Shield className="h-4 w-4" />
              Create Account
            </Button>
          </div>
        </Card>
      ) : (
        // Auth configured — show update form
        <div className="space-y-6">
          <Card>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink-100">Login Active</h3>
                <p className="text-xs text-ink-500">
                  Logged in as <span className="font-medium text-ink-300">{authQuery.data?.username}</span>
                </p>
              </div>
            </div>

            <h4 className="mb-4 text-sm font-semibold text-ink-200">Change Credentials</h4>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-300">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Required to make changes"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 pr-12 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="h-px bg-ink-800/50" />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-300">New Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder={authQuery.data?.username ?? 'Leave blank to keep current'}
                  autoComplete="username"
                  className="w-full rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-300">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-ink-700 bg-ink-800/50 px-4 py-3 pr-12 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {newPassword && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-300">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    className={`w-full rounded-xl border bg-ink-800/50 px-4 py-3 text-sm text-ink-100 placeholder-ink-600 outline-none transition-colors focus:ring-1 ${
                      passwordMismatch
                        ? 'border-red-600 focus:border-red-500 focus:ring-red-500/30'
                        : 'border-ink-700 focus:border-accent-500 focus:ring-accent-500/30'
                    }`}
                  />
                  {passwordMismatch && (
                    <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6">
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={!canUpdate || updateMutation.isPending}
                loading={updateMutation.isPending}
              >
                Update Credentials
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
