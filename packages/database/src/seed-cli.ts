/** db:seed CLI：创建演示用户 + 工作空间 + 快速开始页（依赖 packages/ydoc 的构建器） */
import { eq } from 'drizzle-orm'
import { SQL } from 'bun'
import { buildQuickStartState, extractPageMeta } from '@linkbase/ydoc'
import { drizzle } from './src/index.ts'
import { pageSnapshots, pages, users, workspaceMembers, workspaces } from './src/schema.ts'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL 未设置（参考 .env.example）')
  process.exit(1)
}

const db = drizzle(url)

const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, 'dev@linkbase.local')).limit(1)
if (existing.length > 0) {
  console.log('seed: dev@linkbase.local 已存在，跳过')
  process.exit(0)
}

const userId = crypto.randomUUID()
const wsId = crypto.randomUUID()
const pageId = crypto.randomUUID()

await db.transaction(async (tx) => {
  await tx.insert(users).values({
    id: userId,
    email: 'dev@linkbase.local',
    passwordHash: await Bun.password.hash('linkbase123', { algorithm: 'argon2id' }),
    name: 'Dev',
    locale: 'zh-CN',
  })
  await tx.insert(workspaces).values({ id: wsId, name: 'Dev 的工作空间', createdBy: userId })
  await tx.insert(workspaceMembers).values({ workspaceId: wsId, userId, role: 'owner' })
  await tx.insert(pages).values({
    id: pageId,
    workspaceId: wsId,
    title: '欢迎使用 Linkbase',
    createdBy: userId,
  })
  const state = buildQuickStartState('zh-CN')
  await tx.insert(pageSnapshots).values({ pageId, version: 1, blob: state, reason: 'auto' })
  await tx
    .update(pages)
    .set({ text: extractPageMeta(state).text })
    .where(eq(pages.id, pageId))
})

console.log(`seed ok: dev@linkbase.local / linkbase123, workspace=${wsId}, page=${pageId}`)
process.exit(0)
