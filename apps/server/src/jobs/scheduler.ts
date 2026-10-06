/**
 * 进程内定时任务（07 §6）：setInterval + 启动随机延迟错峰；幂等、每次执行记日志。
 * trash-cleanup：每小时扫描 30 天前进回收站的页 → 物理删除子树；
 * snapshot-merge：每 15 分钟扫描距上次合并 > 1h 且有增量的页（08 §4.3）。
 */
import { and, eq, lt } from 'drizzle-orm'
import { pages } from '../db/index.ts'
import { logger } from '../lib/logger.ts'
import type { LinkbaseDb } from '../lib/deps.ts'
import { mergeStalePages } from '../services/docs.service.ts'
import { createPagesService } from '../services/pages.service.ts'

const HOUR_MS = 3600 * 1000
const DAY_MS = 24 * HOUR_MS

export function startScheduler(db: LinkbaseDb): () => void {
  const timers: ReturnType<typeof setTimeout>[] = []

  const every = (intervalMs: number, fn: () => Promise<void>, name: string) => {
    // 启动随机延迟 0–30s 错峰；任务幂等，先跑一次也无害
    const initial = setTimeout(() => {
      void fn().catch((error) => logger.error({ error, job: name }, 'job failed (initial)'))
    }, Math.floor(Math.random() * 30_000))
    const timer = setInterval(() => {
      void fn().catch((error) => logger.error({ error, job: name }, 'job failed'))
    }, intervalMs)
    timers.push(initial, timer)
  }

  every(
    HOUR_MS,
    async () => {
      const stale = await db
        .select({ id: pages.id, workspaceId: pages.workspaceId })
        .from(pages)
        .where(
          and(
            eq(pages.isTrash, true),
            lt(pages.deletedAt, new Date(Date.now() - 30 * DAY_MS)),
          ),
        )
      const svc = createPagesService(db)
      for (const row of stale) {
        try {
          await svc.permanentDelete(row.workspaceId, row.id)
        } catch (error) {
          logger.error({ error, pageId: row.id }, 'trash purge failed')
        }
      }
      logger.info({ removed: stale.length }, 'trash-cleanup done')
    },
    'trash-cleanup',
  )

  every(
    15 * 60 * 1000,
    async () => {
      const merged = await mergeStalePages(db)
      logger.info({ merged }, 'snapshot-merge done')
    },
    'snapshot-merge',
  )

  return () => timers.forEach(clearTimeout)
}
