import { defineConfig, devices } from '@playwright/test'

/** e2e（90-T1.9）：web = http://localhost:5173（bun dev）；或 E2E_BASE 指向 compose.e2e 的 3101 */
const baseURL = process.env.E2E_BASE ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // 全栈模式（compose.e2e）下由外部保证服务就绪；dev 模式假设 bun dev 已起
})
