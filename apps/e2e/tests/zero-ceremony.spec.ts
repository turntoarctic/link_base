/**
 * 零仪式注册 → 快速开始页（P0-2 主路径，04 §7）。
 * 需要真实后端：E2E_API=1 且 bun dev（或 compose.e2e）在跑；默认跳过。
 */
import { expect, test } from '@playwright/test'

const hasApi = process.env.E2E_API === '1'

test.skip(!hasApi, '需要后端（E2E_API=1）')

test('注册后直接进入工作空间与可输入的快速开始页', async ({ page }) => {
  const email = `e2e-${Date.now()}@test.dev`
  await page.goto('/register')
  await page.getByLabel('昵称').fill('E2E')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel(/密码/).fill('password123')
  await page.getByRole('button', { name: '注册' }).click()

  // URL 落到 /:wsId/page/:pageId，标题输入框出现，编辑器可输入
  await expect(page).toHaveURL(/\/page\//)
  const editor = page.locator('.ProseMirror')
  await expect(editor).toBeVisible({ timeout: 15_000 })
  await expect(editor).toContainText('欢迎使用', { timeout: 15_000 })
})

test('登录全链：注册用户登出后可重新登录', async ({ page }) => {
  const email = `e2e-login-${Date.now()}@test.dev`
  await page.goto('/register')
  await page.getByLabel('昵称').fill('Login')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel(/密码/).fill('password123')
  await page.getByRole('button', { name: '注册' }).click()
  await expect(page).toHaveURL(/\/page\//, { timeout: 15_000 })

  // 退出登录
  await page.getByRole('button', { name: /E2E|Login/ }).first().click()
  await page.getByText('退出登录').click()
  await expect(page).toHaveURL(/\/login/)

  // 重新登录
  await page.goto('/login')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel(/密码/).fill('password123')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/\/(page|.*\/page)\//, { timeout: 15_000 })
})
