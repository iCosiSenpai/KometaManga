import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import App from './App'
import './index.css'

/* Auto-reload when a new service-worker takes control (e.g. after deploy) */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

/* Scrollbar auto-hide: show on scroll, hide after 2s idle */
;(function initScrollHide() {
  let timer: ReturnType<typeof setTimeout> | undefined
  const show = () => {
    document.documentElement.classList.add('is-scrolling')
    clearTimeout(timer)
    timer = setTimeout(() => document.documentElement.classList.remove('is-scrolling'), 2000)
  }
  window.addEventListener('scroll', show, { passive: true, capture: true })
  window.addEventListener('wheel', show, { passive: true })
  window.addEventListener('touchmove', show, { passive: true })
})()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
