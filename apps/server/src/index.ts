/**
 * 启动（07 §2）：迁移 → Bun.serve（REST + 静态；WS Phase 2）→ 定时任务；优雅停机。
 * Bun.serve.maxRequestBodySize 兜底（doc/blob 单独限制在路由层）。
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runMigrations } from '@linkbase/database'
import { createApp } from './app.ts'
import { db } from './db/index.ts'
import { createKV, createSessions } from './db/redis.ts'
import { env } from './env.ts'
import { logger } from './lib/logger.ts'
import { startScheduler } from './jobs/scheduler.ts'
import { mountStatic } from './static.ts'

async function main(): Promise<void> {
  logger.info('starting linkbase server')

  // 迁移随启动执行（08 §1）
  try {
    const applied = await runMigrations(env.DATABASE_URL)
    logger.info({ applied: applied.length }, 'migrations ready')
  } catch (error) {
    logger.error({ error }, 'migrations failed')
    process.exit(1)
  }

  const kv = createKV()
  const app = createApp({ db, kv, sessions: createSessions(kv), appOrigin: env.APP_ORIGIN ?? '' })

  // 前端产物存在则托管（开发态由 Vite 5173 代理 /api）
  const here = dirname(fileURLToPath(import.meta.url))
  const distDir = join(here, '../../web/dist')
  let hasDist = false
  try {
    hasDist = await Bun.file(join(distDir, 'index.html')).exists()
  } catch {
    hasDist = false
  }
  if (hasDist) mountStatic(app, distDir)

  const server = Bun.serve({
    fetch: app.fetch,
    port: env.PORT,
    maxRequestBodySize: 64 * 1024 * 1024,
  })
  logger.info({ port: env.PORT, static: hasDist }, 'linkbase server listening')

  const stopScheduler = startScheduler(db)

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down')
    stopScheduler()
    server.stop(true) // 在飞请求快速排空；WS 房间广播随 Phase 2（09 §7）
    const client = db.$client as unknown as { end?: () => Promise<void>; close?: () => Promise<void> }
    void (client.end?.() ?? client.close?.() ?? Promise.resolve()).catch(() => {})
    void kv.close()
    setTimeout(() => process.exit(0), 500)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

void main()
