import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpError } from './lib/fetch'
import { I18nextProvider } from 'react-i18next'
import './styles/index.css'
import 'katex/dist/katex.min.css'
import { initI18n } from './i18n'
import { App } from './app/router'
import { initTheme } from './stores/ui'
import { TooltipProvider } from './components/ui/tooltip'
import { Toaster } from './components/ui/sonner'

// gcTime 默认即 5 分钟，无需显式配置
// 429 限流：退避重试（5s），其余错误最多 1 次；窗口聚焦不自动 refetch（避免限流风暴）
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof HttpError && error.status === 429) return failureCount < 2
        return failureCount < 1
      },
      retryDelay: (attempt, error) => (error instanceof HttpError && error.status === 429 ? 5_000 : Math.min(1_000 * 2 ** attempt, 5_000)),
      refetchOnWindowFocus: false,
    },
  },
})

initI18n().then((i18n) => {
  initTheme()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <App />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </I18nextProvider>
    </StrictMode>,
  )
})
