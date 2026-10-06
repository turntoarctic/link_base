/** 组件测试（06 §1.1-9：web 用 Vitest；验证 T0.8 登录页双语可切换） */
import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import { initI18n } from '@/i18n'
import LoginPage from '@/features/auth/login-page'

describe('登录页双语（P0-13）', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  test('默认中文：标题与按钮为 zh-CN', async () => {
    const i18n = await initI18n()
    await i18n.changeLanguage('zh-CN')
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </I18nextProvider>,
    )
    expect(screen.getByText('登录 Linkbase')).toBeTruthy()
    expect(screen.getByText('登录', { selector: 'button[type="submit"]' })).toBeTruthy()
    expect(document.documentElement.lang).toBe('zh-CN')
  })

  test('切换 en：文案随语言变化（不刷新页面）', async () => {
    const i18n = await initI18n()
    await i18n.changeLanguage('en')
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </I18nextProvider>,
    )
    expect(screen.getByText('Log in to Linkbase')).toBeTruthy()
    expect(screen.getByText('Log in', { selector: 'button[type="submit"]' })).toBeTruthy()
    expect(document.documentElement.lang).toBe('en')
  })
})
