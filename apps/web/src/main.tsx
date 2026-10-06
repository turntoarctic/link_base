import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import './styles/index.css'
import { initI18n } from './i18n'
import { App } from './app/router'
import { initTheme } from './stores/ui'

const queryClient = new QueryClient({
  gcTime: 5 * 60 * 1000,
})

initI18n().then((i18n) => {
  initTheme()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </I18nextProvider>
    </StrictMode>,
  )
})
