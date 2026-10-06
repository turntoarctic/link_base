/**
 * db:seed:bench：万页搜索基准数据（T1.6/P0-10 验收：万页 <500ms）。
 * 用法：bun run db:seed:bench [count]（默认 10000）。
 * 生成 bench@linkbase.local 的独立空间；重复执行先清空其页面再生成。
 */
import { eq } from 'drizzle-orm'
import { createDb } from './index.ts'
import { pageSnapshots, pageUpdates, pages, users, workspaceMembers, workspaces } from './schema.ts'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL 未设置（参考 .env.example）')
  process.exit(1)
}
const count = Number(process.argv[2] ?? '10000')
if (!Number.isInteger(count) || count <= 0 || count > 200_000) {
  console.error('用法: bun run db:seed:bench [count]（1-200000）')
  process.exit(1)
}

const db = createDb(url)
const EMAIL = 'bench@linkbase.local'

const existing = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1)
let userId: string
let wsId: string
if (existing.length > 0) {
  userId = existing[0]!.id
  const memberships = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .limit(1)
  wsId = memberships[0]!.workspaceId
  // 幂等：清空旧基准页（快照/增量随外键级联）
  await db.delete(pages).where(eq(pages.workspaceId, wsId))
  console.log(`seed-bench: 清空旧数据，重新生成 ${count} 页`)
} else {
  userId = crypto.randomUUID()
  wsId = crypto.randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      email: EMAIL,
      passwordHash: await Bun.password.hash('linkbase123', { algorithm: 'argon2id' }),
      name: 'Bench',
    })
    await tx.insert(workspaces).values({ id: wsId, name: '搜索基准空间', createdBy: userId })
    await tx.insert(workspaceMembers).values({ workspaceId: wsId, userId, role: 'owner' })
  })
  console.log(`seed-bench: 新建 ${EMAIL} / linkbase123, workspace=${wsId}`)
}

// 合成中文正文：高频词 + 稀有词（量子涨落常数N，10% 页面命中）——验证 tsvec 主路径与 ILIKE 兜底
const PHRASES = [
  '系统设计评审通过后进入开发阶段',
  '接口契约由前端与后端共同维护',
  '部署流水线在合并请求后自动触发',
  '数据库迁移必须向后兼容旧版本',
  '日志聚合服务统一收集结构化输出',
  '缓存命中率随热点数据变化波动',
  '权限模型以工作空间为边界隔离',
  '协同编辑的冲突由 CRDT 算法消解',
]

const userId_ = userId
const rows = Array.from({ length: count }, (_, i) => {
  const body = [
    PHRASES[i % PHRASES.length]!,
    `本页为第 ${i + 1} 号基准页面，用于验证全文检索与 trigram 子串兜底的延迟表现。`,
    i % 10 === 0 ? `特殊标记：量子涨落常数${i} 出现在本页。` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return {
    id: crypto.randomUUID(),
    workspaceId: wsId,
    title: `基准页 ${String(i + 1).padStart(6, '0')}`,
    text: body,
    createdBy: userId_,
  }
})

const BATCH = 500
let done = 0
while (done < rows.length) {
  const batch = rows.slice(done, done + BATCH)
  await db.transaction(async (tx) => {
    await tx.insert(pages).values(batch)
  })
  done += batch.length
  process.stdout.write(`\rseed-bench: ${done}/${rows.length}`)
}
process.stdout.write('\n')
console.log(`seed-bench ok: ${count} 页, workspace=${wsId}, 登录 ${EMAIL} / linkbase123`)
process.exit(0)
