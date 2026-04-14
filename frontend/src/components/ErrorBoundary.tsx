import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button } from './Button'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-600/10">
            <AlertTriangle className="h-7 w-7 text-accent-400" />
          </div>
          <div className="max-w-md">
            <h2 className="font-display text-lg font-semibold text-ink-100">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-400">
              An unexpected error occurred. Try reloading the page.
            </p>
            {this.state.error && (
              <pre className="mt-3 max-h-24 overflow-auto rounded-lg bg-ink-900 p-3 text-left font-mono text-xs text-ink-500">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
          >
            Reload Page
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
