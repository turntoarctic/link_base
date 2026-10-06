/** 登录页冒烟 + 双语切换（P0-13 e2e 部分，13 §7-4） */
import { expect, test } from '@playwright/test'

test('登录页渲染关键文案（默认中文）', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('登录 Linkbase')).toBeVisible()
  await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
})

test('语言切换：切 en 后文案变化且持久化', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /English/i }).click()
  await expect(page.getByText('Log in to Linkbase')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Log in to Linkbase')).toBeVisible()
})
