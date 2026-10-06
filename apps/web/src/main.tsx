import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import './styles/index.css'
import { initI18n } from './i18n'
import { App } from './app/router'
import { initTheme } from './stores/ui'
import { TooltipProvider } from './components/ui/tooltip'
import { Toaster } from './components/ui/sonner'

// gcTime 默认即 5 分钟，无需显式配置
const queryClient = new QueryClient()

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
