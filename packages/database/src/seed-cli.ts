/** db:seed CLI：创建演示用户 + 工作空间 + 快速开始页（依赖 packages/ydoc 的构建器） */
import { eq } from 'drizzle-orm'
import * as Y from 'yjs'
import { buildQuickStartState, extractPageMeta, markdownToYDoc } from '@linkbase/ydoc'
import { createDb } from './index.ts'
import { pageSnapshots, pages, users, workspaceMembers, workspaces } from './schema.ts'

/** 模板三件（T2.10，02 §3）：会议纪要 / PRD / 技术设计；内容以 markdown 编写后转 Y.Doc */
const TEMPLATES: Array<{ title: string; markdown: string }> = [
  {
    title: '模板：会议纪要',
    markdown: [
      '# 会议纪要',
      '',
      '- 时间：',
      '- 参会：',
      '- 记录：',
      '',
      '## 议题',
      '',
      '- [ ] 议题一',
      '- [ ] 议题二',
      '',
      '## 结论与行动项',
      '',
      '| 行动项 | 负责人 | 截止 |',
      '| --- | --- | --- |',
      '|  |  |  |',
    ].join('\n'),
  },
  {
    title: '模板：PRD',
    markdown: [
      '# 产品需求文档（PRD）',
      '',
      '## 背景与目标',
      '',
      '- 背景描述',
      '',
      '## 用户故事',
      '',
      '- 作为 <角色>，我希望 <能力>，以便 <价值>',
      '',
      '## 功能范围',
      '',
      '| 功能 | 优先级 | 说明 |',
      '| --- | --- | --- |',
      '|  | P0 |  |',
      '',
      '## 非目标',
      '',
      '- 明确不做的部分',
      '',
      '## 验收标准',
      '',
      '- [ ] 验收项一',
    ].join('\n'),
  },
  {
    title: '模板：技术设计',
    markdown: [
      '# 技术设计',
      '',
      '## 需求摘要',
      '',
      '## 方案概述',
      '',
      '## 架构与数据流',
      '',
      '```mermaid',
      'graph TD',
      '  A[客户端] --> B[API]',
      '  B --> C[(数据库)]',
      '```',
      '',
      '## 数据模型',
      '',
      '## 权衡与备选方案',
      '',
      '| 方案 | 优点 | 代价 |',
      '| --- | --- | --- |',
      '|  |  |  |',
      '',
      '## 上线与回滚',
      '',
      '- [ ] 灰度计划',
    ].join('\n'),
  },
]

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL 未设置（参考 .env.example）')
  process.exit(1)
}

const db = createDb(url)

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

// 模板三件（T2.10）：isTemplate 页 + 快照（reason=copy，08 §4.4 的 reason 集合内）
for (const tpl of TEMPLATES) {
  const tplId = crypto.randomUUID()
  const ydoc = markdownToYDoc(tpl.markdown)
  const state = Y.encodeStateAsUpdate(ydoc)
  await db.transaction(async (tx) => {
    await tx.insert(pages).values({
      id: tplId,
      workspaceId: wsId,
      title: tpl.title,
      isTemplate: true,
      createdBy: userId,
    })
    await tx.insert(pageSnapshots).values({ pageId: tplId, version: 1, blob: state, reason: 'copy' })
    await tx.update(pages).set({ text: extractPageMeta(ydoc).text }).where(eq(pages.id, tplId))
  })
}

console.log(`seed ok: dev@linkbase.local / linkbase123, workspace=${wsId}, page=${pageId}, 模板 ${TEMPLATES.length} 件`)
process.exit(0)
